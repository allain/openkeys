var express = require("express");
var async = require("async");
var assert = require("assert");
var fs = require("fs");
var jsmin = require("jsmin").jsmin;

var port = (process.env.VMC_APP_PORT || 2020);
var host = (process.env.VCAP_APP_HOST || "localhost");

var express = require("express");
var app = express();
var api = require("./routes/api");


app.configure(function() {
  app.use(express.methodOverride());
  app.use(express.logger());
  //app.use(express.static(__dirname + "/public"));

  var mongo;
  if (process.env.VCAP_SERVICES){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    mongo = env["mongodb2-2.4.8"][0].credentials;
    console.log(mongo);
  } else {
    mongo = {
      "hostname": "localhost",
      "port": 27017,
      "username": "",
      "password": "",
      "name": "",
      "db": "db"
    };
  }

  mongo.hostname = (mongo.hostname || "localhost");
  mongo.port = (mongo.port || 27017);
  mongo.db = (mongo.db || "test");

  var authPart = "";
  if(mongo.username && mongo.password){
    authPart = mongo.username + ":" + mongo.password + "@";
  }

  var mongoUrl = "mongodb://" + authPart + mongo.hostname + ":" + mongo.port + "/" + mongo.db;

  var store = require("./lib/mongo-store")(mongoUrl);

  // Install store as part of the request object
  app.use(function(req, res, next) {
    req.store = store;
    next();
  });

  // Make rawBody be the raw body when PUT is used and text/plain is the payload
  app.use(function(req, res, next){
    if (req.method === "PUT") {
      var data = [];

      req.on('data', function(chunk){ data.push(chunk); })
      req.on('end', function(){
        req.rawBody = data.join("");
        next();
      });
    } else {
      next();
    }
})

  // Support cross domain queries
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, PUT, DELETE");
    next();
  });
});

app.configure("development", function () {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure("production", function () {
  app.use(express.errorHandler());
});

app.get("/openkeys.js", function(req, res) {
  async.map([
    "/public/bower_components/q/q.js",
    "/public/bower_components/qajax/src/qajax.js",
    "/public/bower_components/js-md5/js/md5.js",
    "/public/bower_components/store-js/store.js",
    "/public/bower_components/js-signals/dist/signals.js",
    "/public/openkeys.js"
  ], function(path, cb) {
    fs.readFile(__dirname + path, "utf-8", cb);
  }, function(err, parts) {
    assert(!err);

    res.set("Content-Type", "text/javascript");
    res.send(parts.join("\n"));
  })
});

app.get("/openkeys.min.js", function(req, res) {
  async.map([
    "/public/bower_components/q/q.js",
    "/public/bower_components/qajax/src/qajax.js",
    "/public/bower_components/js-md5/js/md5.js",
    "/public/bower_components/store-js/store.js",
    "/public/bower_components/js-signals/dist/signals.js",
    "/public/openkeys.js"
  ], function(path, cb) {
    fs.readFile(__dirname + path, "utf-8", function(err, content) {
      if (err) return cb(err);

      cb(null, jsmin(content));
    });
  }, function(err, parts) {
    assert(!err);

    res.set("Content-Type", "text/javascript");
    res.send(parts.join("\n"));
  })
});

app.get("/:key([a-z0-9A-Z\/]+)", api.get);
app.get("/:key([a-z0-9A-Z\/]+).index", api.index);
app.get("/:key([a-z0-9A-Z\/]+)/", api.index);
app.put("/:key([a-z0-9A-Z\/]+)", api.put);
app.del("/:key([a-z0-9A-Z\/]+)", api.del);
app.get("/:key([a-z0-9A-Z\/,]+).:format(json|txt)", api.get);

app.listen(port, host);
