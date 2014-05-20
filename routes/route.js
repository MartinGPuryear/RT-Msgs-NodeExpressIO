module.exports = function Route(app)
{

  //  For this app, we store users in memory, not a DB
  var num_users = 0;
  var users = [];  
  
  //  For this app, we store posts in memory, not a DB
  var num_posts = 0;
  var posts = [];  

  //  For this app, we store replies in memory, not a DB
  var num_replies = 0;
  var replies = [];  

  //  Create/insert a new user with this name and ID.
  function new_user(name, id)
  {
    var postArr = [];
    var replyArr = [];
    users.push( { name: name, user_id: id, posts: postArr, replies: replyArr });
  }

  //  Create/insert a new post with this text, from this user.
  function new_post(text, post_id, name, user_id)
  {
      posts.push( { text: text, post_id: post_id, poster: name } );
      users[user_id].posts.push(text);
  }

  //  Create/insert a new reply with this text, on this post, from this user.
  function new_reply(text, reply_id, post_id, name, user_id)
  {
    replies.push( { text: text, reply_id: reply_id, post_id: post_id, replier: name } );
    users[user_id].replies.push(text);
  }

  //    Broadcast the top three leaders, in numbers of posts/replies.
    //  For each user, insert them into a sorted list (capped at 3).
    //  Then send these leaders to app.io (all). 
  function update_leaders(request = null)
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
    if (request)
    {
      request.io.emit('leaderboard_updated', { leaders: leaders });
    }
    else
    { 
      app.io.broadcast('leaderboard_updated', { leaders: leaders });
    }
  }


  //  Route message handling

  //    Client has connected, main page ready. Send out the leaderboard.
    //  We send this out to the entire world, because the leaders
    //  may have changed as a result of this user joining.  
  app.io.route('ready',      function(request) 
    { 
      update_leaders();
    });

  //    Client loaded a profile. Send that profile's posts/replies.
  //    Also, provide the leaderboard to that client only.
  app.io.route('profile_ready',      function(request) 
    { 
      update_leaders(request);
      var profile_id = request.session.visiting_profile_id;
      request.io.emit('user_post_list_received', { posts: users[profile_id].posts } );
      request.io.emit('user_reply_list_received', { replies: users[profile_id].replies } );
    });

  app.io.route('disconnect', function(request) 
    {
    });

  //    Client created a post.  Broadcast it, and an updated leaderboard. 
  app.io.route('new_post', function(request) 
    {
      num_posts++;
      new_post(request.data.text, num_posts - 1, request.session.name, request.session.user_id);
      app.io.broadcast('new_post_received', { poster: request.session.name, text: request.data.text, post_id: num_posts - 1 });

      update_leaders();
    });

  //    Client created a reply.  Broadcast it, and an updated leaderboard. 
  app.io.route('new_reply', function(request)
    {
      num_replies++;
      new_reply(request.data.text, num_replies - 1, request.data.post_id, request.session.name, request.session.user_id);
      app.io.broadcast('new_reply_received', { replier: request.session.name, text: request.data.text, post_id: request.data.post_id })

      update_leaders();
    });

  //    Client requested the list of all posts - emit it.
  app.io.route('request_all_post_list', function(request) 
    {
      request.io.emit('all_post_list_received', { posts: posts })
    });

  //    Client requested the list of all replies - emit it.
  app.io.route('request_all_reply_list', function(request) 
    {
      request.io.emit('all_reply_list_received', { replies: replies })
    });

  //    Client requested the list of leaders - emit it.
  app.io.route('request_leaderboard', function(request) 
    {
      update_leaderboard();
    });


  //  URL handling 

  //    Root URL is routed to the index view, a login page.
  app.get('/', function(request, response)
    {
      response.render('index', { title:'Enter the Wall', error: request.session.error });
    });

  //    Index URL is redirected to the root URL.
  app.get('/index', function(request, response)
    {
      response.redirect('/');
    });

  //    Posting to /login creates a user, logs them in, redirects to wall. 
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

  //    The wall view is our real-time message board. All we really need 
    //  to be passed is our name - the view requests other info it needs.
  app.get('/wall', function(request, response)
    {
      response.render('wall', { title:'Real-Time Message Board', name:request.session.name });
    });

  //    Profile view displays this user's name, the list of their posts,
    //  and the list if their comments.  Like the wall view, all we
    //  really need to pass is the name - the view will ask for the rest.  
  app.get('/profile/:user_name', function(request, response)
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

  //    User logged out/disconnected.  Clear out session, redirect to /.
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
