var _ = require("lodash"),
  async = require("async");

function get(req, res) {
  var format = req.params.format || "txt";

  if (format !== "json" && format !== "txt") {
    return res.send(400, "unsupported format");
  }

  var key = req.params.key;

  if (key.indexOf(",") !== -1) {
    if (format !== "json") return res.send(400, "multi-keys only allowed with JSON");
    var expandedKeys = expandKeys(key);
    var mappings = {};
    async.each(expandedKeys, function(key, cb) {
      if (!key.match(/^([a-z0-9A-Z]+\/)*[a-z0-9A-Z]+$/)) {
        return cb("invalid key");
      }

      req.store.get(key, function(err, value) {
        if (err) return cb(err);

        console.log(value);

        mappings[key] = value ? JSON.parse(value) : null;
        cb();
      });
    }, function(err) {
      if (err) return res.send(500, err);

      res.json(200, mappings);
    });
  } else {
    if (!key.match(/^([a-z0-9A-Z]+\/)*[a-z0-9A-Z]+$/)) {
      return res.send(400, "invalid key");
    }

    req.store.get(key, function(err, value) {
      if (err) {
        return res.send(500, err);
      }

      if (value === undefined) {
        return res.send(404, "not found");
      }

      if (format === "json") {
        res.json(200, JSON.parse(value));
      } else if (format === "txt") {
        res.set("Content-Type", "text/plain");
        res.send(200, value);
      }
    });
  }
}

function expandKeys(keys) {
  var segments = _.map(keys.split("/"), function(segment) { return segment.split(","); });

  if (segments.length  === 1) {
    return segments[0];
  }


  var expandedKeys = crossJoinPieces(segments[0], segments[1], "/");

  for (var i = 2, n = segments.length; i < n - 1; i++) {
    expandedKeys = crossJoinPieces(expandedKeys, segments[i], "/");
  }

  return expandedKeys;
}

function crossJoinPieces(aKeys, bKeys, delimeter) {
  var results = [];
  for (var aIndex = 0, aLen = aKeys.length; aIndex < aLen ; aIndex ++) {
    for (var bIndex = 0, bLen = bKeys.length; bIndex < bLen; bIndex ++) {
      results.push(aKeys[aIndex] + delimeter + bKeys[bIndex]);
    }
  }
  return results;
}

function put(req, res) {
  var key = req.params.key;

  if (!key.match(/^([a-z0-9A-Z]+\/)*[a-z0-9A-Z]+$/)) {
    return res.send(400, "invalid key");
  }

  var value = req.body;

  if (value !== "" && value !== undefined) {
    var encodedValue = value;
    if (req.is("application/json")) {
      encodedValue = JSON.stringify(value);
    }

    req.store.put(key, encodedValue, function(err) {
      if (err) {
        return res.send(500, "error saving item");
      }

      res.send(200, "ok");
    });
  } else {
    res.send(400, "empty payload");
  }
}

function del(req, res) {
  var key = req.params.key;
  req.store.get(key, function(err, value) {
    if (err) return res.send(500, err);

    if (value === undefined) return res.send(404, "not found");

    req.store.del(key, function(err) {
      if (err) return res.send(500, "error deleting item");

      res.send(200, "ok");
    });
  });
}

module.exports = {
  get: get,
  put: put,
  del: del,
  expandKeys: expandKeys
};