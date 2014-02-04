var mongodb = require("mongodb");

module.exports = function(mongoUrl) {
  function runConnected(action, callback) {
    mongodb.connect(mongoUrl, function(err, db) {
      if (err) {
        return callback(err);
      }

      db.collection("openkeys-items", function (err, collection) {
        if (err) {
          db.close();
          return callback(err);
        }

        action(collection, function(err, result) {
          db.close();
          callback(err, result);
        });
      });
    });
  }

  function put(key, value, callback) {
    runConnected(function(collection, cb) {
      collection.update(
        {key: key},
        {key: key, value: value, updated: +new Date()},
        {safe: true, multi: false, upsert: true},
        cb
      );
    }, function(err) {
      if (err) return cb("updating");

      callback();
    });
  }

  function index(keyPrefix, callback) {
    runConnected(function(collection, cb) {
      collection.find({
        key: new RegExp("^" + keyPrefix+"/")
      }, function (err, cursor) {
        if (err) return cb(err);

        var index = {};

        cursor.toArray(function(err, rawIndex) {
          rawIndex.forEach(function(item) {
            index[item.key.substr(keyPrefix.length + 1)] = item.updated;
          });
          cb(null, index);
        });
      });
    }, function(err, index) {
      if (err) return callback("indexing");

      callback(null, index);
    });
  }

  function get(key, callback) {
    runConnected(function(collection, cb) {
      collection.findOne({key: key}, function (err, record) {
        if (err) return cb(err);

        if (record) {
          cb(null, record.value);
        } else {
          cb();
        }
      });

    }, function (err, value) {
      if (err) return callback("getting");

      callback(null, value);
    });
  }

  function del(key, callback) {
    runConnected(function(collection, cb) {
      collection.remove({key: key}, {single: true}, cb);
    }, function(err, val) {
      if (err) return callback("removing");

      return callback(null, val);
    });
  }

  return {
    get: get,
    put: put,
    del: del,
    index: index
  };
};