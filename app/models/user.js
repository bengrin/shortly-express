var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      var password = model.get('password');
      bcrypt.hash(password, 10, function(err, hash) {
        //store username with hashed password
        model.set('password', hash);
      });
    });
  }
});

module.exports = User;

