var assert = require("chai").assert,
    api = require("../routes/api");

describe("api", function() {
  describe("index", function() {
    api.index({
      store: {
        index: function(keyPrefix, callback) {
          callback(null, {
            "a/1": 1,
            "a/2": 2
          });
        }
      },
      params: {
        key: "a"
      }
    }, {
      json: function(status, json) {
        assert.equal(status, 200);
        assert.deepEqual(json, {
          "a/1": 1,
          "a/2": 2
        });
      }
    });
  });

  describe("get", function() {
    it("getting missing key yields 404", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            callback(null, undefined);
          }
        },
        params: {
          key: "missing",
          format: "json"
        }
      }, {
        send: function(status, message) {
          assert.equal(status, 404);
          assert.equal(message, "not found");
          done();
        }
      });
    });

    it("getting found key with json format yields json", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            callback(null, JSON.stringify("Found Content"));
          }
        },
        params: {
          key: "found",
          format: "json"
        }
      }, {
        json: function(status, json) {
          assert.equal(status, 200);
          assert.equal(json, "Found Content");
          done();
        }
      });
    });

    it("defaults to txt if format not given", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            assert.equal(key, "found");
            callback(null, "Found Content");
          }
        },
        params: {
          key: "found"
        }
      }, {
        set: function() {

        },
        send: function(status, content) {
          assert.equal(status, 200);
          assert.equal(content, "Found Content");
          done();
        }
      });
    });

    it("returns text when txt is format", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            callback(null, "Found Content");
          }
        },
        params: {
          key: "found",
          format: "txt"
        }
      }, {
        set: function() {

        },
        send: function(status, content) {
          assert.equal(status, 200);
          assert.equal(content, "Found Content");
          done();
        }
      });
    });

    it("querying for unsupported format fails", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            callback(null, "Found Content");
          }
        },
        params: {
          key: "found",
          format: "BAD"
        }
      }, {
        send: function(status, message) {
          assert.equal(status, 400);
          assert.equal(message, "unsupported format");
          done();
        }
      });
    });

    it("querying for multiple keys works", function(done) {
      api.get({
        store: {
          get: function(key, callback) {
            callback(null, JSON.stringify(key + " content"));
          }
        },
        params: {
          key: "a,b/c",
          format: "json"
        }
      }, {
        send: function() {
          assert(false, "should not fail out");
        },
        json: function(status, json) {
          assert.equal(status, 200);
          assert.deepEqual(json, {
            "a/c": "a/c content",
            "b/c": "b/c content"
          });
          done();
        }
      });
    });
  });

  describe("put", function() {
    it("it returns ok when valid put", function(done) {
      api.put({
        is: function() {
          return false;
        },
        store: {
          put: function(key, value, callback) {
            assert.equal(key, "a");
            assert.equal(value, "content");
            callback();
          }
        },
        params: {
          key: "a"
        },
        body: "content"
      }, {

        send: function(status, message) {
          assert.equal(status, 200);
          assert.equal(message, "ok");
          done();
        }
      });
    });

    it("fails with 400 when body is empty", function(done) {
      api.put({
        store: {
          put: function() {
            assert(false, "should never get here");
          }
        },
        params: {
          key: "a"
        },
        body: ""
      }, {
        send: function(status, message) {
          assert.equal(status, 400);
          assert.equal(message, "empty payload");
          done();
        }
      });
    });

    it("fails with 400 when key contains commas", function(done) {
      api.put({
        params: {
          key: "a,b"
        }
      }, {
        send: function(status, message) {
          assert.equal(status, 400);
          assert.equal(message, "invalid key");
          done();
        }
      });
    });
  });

  describe("delete", function() {
    it("deleting missing item yields 404", function(done) {
      api.del({
        store: {
          get: function(key, callback) {
            assert.equal(key, "missing");
            callback(null, undefined);
          },
          del: function() {
            assert(false, "should never get this far");
          }
        },
        params: {
          key: "missing"
        }
      }, {
        send: function(status, message) {
          assert.equal(404, status);
          assert.equal(message, "not found");
          done();
        }
      });
    });

    it("deleting existing item does so", function(done) {
      api.del({
        store: {
          get: function(key, callback) {
            assert.equal(key, "found");
            callback(null, "found content");
          },
          del: function(key, callback) {
            assert.equal(key, "found");
            callback();
          }
        },
        params: {
          key: "found"
        }
      }, {
        send: function(status, message) {
          assert.equal(200, status);
          assert.equal(message, "ok");
          done();
        }
      });
    });
  });

  it("expands keys properly", function() {
    assert.deepEqual(api.expandKeys("a"), ["a"]);
    assert.deepEqual(api.expandKeys("a,b"), ["a", "b"]);
    assert.deepEqual(api.expandKeys("a,b/c"), ["a/c", "b/c"]);
  });
});
