var mongodb = require("mongodb");

module.exports = function(mongourl) {
  function connect(callback) {
    mongodb.connect(mongourl, function(err, conn) {
      if (err) {
        return callback(err);
      }

      conn.collection("openkeys-items", callback);
    });
  }

  function put(key, value, callback) {
    connect(function(err, collection) {
      if (err) return "connection";

      var doc = {
        key: key,
        value: value
      };

      collection.update({key: key}, doc, {safe: true, multi: false, upsert: true}, function(err) {
        if (err) return callback("updating");

        callback();
      });
    });
  }

  function get(key, callback) {
    connect(function(err, collection) {
      if (err) {
        return callback({error: "connection", stauts: 500});
      }

      collection.findOne({key: key}, function (err, record) {
        if (err) {
          return callback("getting");
        }

        if (record) {
          callback(null, record.value);
        } else {
          callback();
        }
      });
    });
  }

  function del(key, callback) {
    connect(function(err, collection) {
      if (err) return callback("connection");

      collection.remove({key: key}, {single: true}, function (err, val) {
        if (err) return callback("removing");

        callback(null, val);
      });
    });
  }

  return {
    get: get,
    put: put,
    del: del
  };
};