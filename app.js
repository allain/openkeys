var express = require("express");

var port = (process.env.VMC_APP_PORT || 2020);
var host = (process.env.VCAP_APP_HOST || "localhost");

var express = require("express");
var app = express();
var api = require("./routes/api");


app.configure(function() {
  app.use(express.methodOverride());
  app.use(express.bodyParser({strict: false}));
  app.use(express.logger());
  app.use(express.static(__dirname + "/public"));

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
    console.log(mongoUrl);

    req.store = store;
    next();
  });

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

app.get("/:key([a-z0-9A-Z\/]+)", api.get);
app.get("/:key([a-z0-9A-Z\/]+).index", api.index);
app.get("/:key([a-z0-9A-Z\/]+)/", api.index);
app.put("/:key([a-z0-9A-Z\/]+)", api.put);
app.del("/:key([a-z0-9A-Z\/]+)", api.del);
app.get("/:key([a-z0-9A-Z\/,]+).:format(json|txt)", api.get);

app.listen(port, host);
