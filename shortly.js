var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');

// github passport setup
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;

var GITHUB_CLIENT_ID = "5631142f1d2e2717616d";
var GITHUB_CLIENT_SECRET = "1ba4e04f86d5799fd3098cef301f57d6394cb28a";

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      
      return done(null, profile);
    });
  }
));

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'hackreactor',
  resave: false,
  saveUninitialized: true
}));
// Passport
app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser,
function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  
  new User({ username : username }).fetch().then(function(user) {
    if (user) {
      console.log('That username already exists!');
      res.redirect('/signup');
    } else {
      var newUser = new User({
        username : username, 
        password : password
      });
      
      newUser.save().then(function(user){
        Users.add(user);
        req.session.regenerate(function() {
          req.session.user = username;
          res.redirect('/');
        });
      }, function(err){
        console.log(err);
      });
    }
  }, function(err) {
    res.status(404).send();
  });
});

app.post('/login', function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username}).fetch().then(function(user) {
    if (user) {
      bcrypt.compare(password, user.get('password'), function(err, match){
        if (match) {
          req.session.regenerate(function() {
            req.session.user = user;
            res.redirect('/');
          });
        } else {
          res.redirect('/login');
        }
      });
    } else {
      res.redirect('/login');
    }
  }, function(err) {
    res.status(404).send();
  });
});

// app.get('/logout', function(req, res) {
//   req.session.destroy(function(){
//     res.redirect('/login');
//   });
// });
app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
