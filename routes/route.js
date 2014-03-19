module.exports = function Route(app)
{
  var num_users = 0;
  var users = [];  
  
  var num_posts = 0;
  var posts = [];  

  var num_replies = 0;
  var replies = [];  

  function new_user(name, id)
  {
    var postArr = [];
    var replyArr = [];
    users.push( { name: name, user_id: id, posts: postArr, replies: replyArr });
  }

  function new_post(text, post_id, name, user_id)
  {
      posts.push( { text: text, post_id: post_id, poster: name } );
      users[user_id].posts.push(text);
  }

  function new_reply(text, reply_id, post_id, name, user_id)
  {
    replies.push( { text: text, reply_id: reply_id, post_id: post_id, replier: name } );
    users[user_id].replies.push(text);
  }

  function update_leaders()
  {
    var user_num = 0;
    high_val = -1;
    leaders = [ { name: '', count: -1 }, { name: '', count: -1 }, { name: '', count: -1 } ];

    for (var user_num = 0; user_num < users.length; user_num++)
    {
      count = users[user_num].posts.length + users[user_num].replies.length;
      if (count > leaders[2].count)
      {
        if (count > leaders[1].count)
        {
          leaders[2].count = leaders[1].count;
          leaders[2].name  = leaders[1].name;
          if (count > leaders[0].count)
          {
            leaders[1].count = leaders[0].count;
            leaders[1].name  = leaders[0].name;
            leaders[0].count = count;
            leaders[0].name  = users[user_num].name;
          }
          else
          {
            leaders[1].count = count;
            leaders[1].name  = users[user_num].name;
          }
        }
        else
        {
          leaders[2].count = count;
          leaders[2].name  = users[user_num].name;
        }
      }
    }
    app.io.broadcast('leaderboard_updated', { leaders: leaders });
  }

  app.io.route('ready',      function(request) 
    { 
      console.log('RECEIVED: ready'); 
      update_leaders();
    });

  app.io.route('profile_ready',      function(request) 
    { 
      update_leaders();
      var profile_id;
      // if (request.session.visiting_profile_id)
      {
        profile_id = request.session.visiting_profile_id;
      }
      // else
      {
        // profile_id = request.session.user_id;
      }
      request.io.emit('user_post_list_received', { posts: users[profile_id].posts } );
      request.io.emit('user_reply_list_received', { replies: users[profile_id].replies } );
    });

  app.io.route('disconnect', function(request) 
    {
      // console.log("RECEIVED: disconnect (" + request.session.name + " @ " + request.session.sessionID + ")");
    });

  app.io.route('new_post', function(request) 
    {
      num_posts++;
      new_post(request.data.text, num_posts - 1, request.session.name, request.session.user_id);
      app.io.broadcast('new_post_received', { poster: request.session.name, text: request.data.text, post_id: num_posts - 1 });

      update_leaders();
    });

  app.io.route('new_reply', function(request)
    {
      num_replies++;
      new_reply(request.data.text, num_replies - 1, request.data.post_id, request.session.name, request.session.user_id);
      app.io.broadcast('new_reply_received', { replier: request.session.name, text: request.data.text, post_id: request.data.post_id })

      update_leaders();
    });

  app.io.route('request_all_post_list', function(request) 
    {
      request.io.emit('all_post_list_received', { posts: posts })
    });

  app.io.route('request_all_reply_list', function(request) 
    {
      request.io.emit('all_reply_list_received', { replies: replies })
    });

  app.io.route('request_leaderboard', function(request) 
    {
      update_leaderboard();
    });

  app.post('/login', function(request, response)
    {
      if (request.body.name)
      {
        num_users++;

        request.session.error = null;
        request.session.name = request.body.name;
        request.session.user_id = num_users - 1;          // unique ID for user
        request.session.sessionID = request.sessionID;    // unique sessionID for user

        new_user(request.session.name, request.session.user_id);

        request.session.save(function() 
          {
            response.redirect('/wall');
          }); 
      }
      else
      {
        request.session.error = 'Name cannot be blank';
        request.session.save(function() 
          {
            response.redirect('/');
          }); 
      }
    });

  app.get('/', function(request, response)
    {
      response.render('index', { title:'Enter the Wall', error: request.session.error });
    });

  app.get('/wall', function(request,response)
    {
      response.render('wall', { title:'Real-Time Message Board', name:request.session.name });
    });

  app.get('/profile/:user_name', function(request,response)
    {
      for (var i = 0; i < users.length; i++) 
      {
        if (users[i].name == request.route.params.user_name)
        {
          break;
        }
      }
      if (i < users.length)
      { 
        request.session.visiting_profile_id = i;
        request.session.save();
        response.render('profile', { title: 'Your Post Activity', user_name: request.route.params.user_name });
      }
      else
      {
        request.session.error = 'Profile not found';
        request.session.save(function() 
          {
            response.redirect('/');
          }); 
      }
    });

  app.get('/logout', function(request, response)
    {
      request.session.name = null;
      request.session.sessionID = null;  // unique sessionID for user
      request.session.save(function() 
        {
          response.redirect('/');
        }); 
    });

}
