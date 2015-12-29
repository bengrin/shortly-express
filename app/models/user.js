var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  //hasTimestamps: true,
  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      var password = model.get('password');
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(password, salt);
      model.set('password', hash);
    });
  }
});

module.exports = User;

