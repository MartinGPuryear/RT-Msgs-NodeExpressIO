var express = require('express.io');
var path = require('path');
var app = express().http().io();
var port = 6789;

        //    configure our environment
app.configure(function()
  {
    app.use(express.cookieParser());  

    // app.use(express.bodyParser());                  
        //    handle POST data
        //    above is deprecated -- below will be in Express 3.0
    app.use(express.urlencoded());
    app.use(express.json());

        //    handle static contents
    app.use(express.static(path.join(__dirname, 'public')));

        //    sessions
    app.use(express.session({secret: 'peach'}));

    app.set('view engine', 'ejs');
  });

        //    /routes/index.js handles all routing
var route = require('./routes/route.js')(app);
app.listen(port);

console.log('\n ***************************************************');
console.log('*****                                           *****');
console.log('*****   Express server listening on port ' + port + '   *****');
console.log('*****                                           *****');
console.log(' ***************************************************\n');
