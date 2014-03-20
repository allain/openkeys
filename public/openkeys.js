window.openkeys = (function() {
  var logError = function(msg) {
    if (window.console && window.console.error) {
      console.error(msg);
    }
  };

  return function(appName, endpointUrl) {
    endpointUrl = endpointUrl || "https://openkeys.aws.af.cm";

    function get(key) {
      var defered = Q.defer();

      Qajax(endpointUrl + "/" + key)
        .then(Qajax.filterSuccess)
        .get('responseText')
        .then(defered.resolve, function(xhr) {
          if (xhr.status === 404) {
            defered.resolve(undefined);
          } else {
            defered.reject(xhr);
          }
        });

      return defered.promise;
    }

    function put(key, value) {
      return Qajax({
        url: endpointUrl + "/" + key,
        method: "PUT",
        data: value,
        headers: {
          "Content-Type": "text/plain"
        }
      })
      .then(Qajax.filterSuccess);
    }

    function remove(key) {
      return Qajax({
        url: endpointUrl + "/" + key,
        method: "DELETE",
      })
      .then(Qajax.filterStatus(function (code) {
        // Treat a missing record as a successful deletion
        return code === 200 || code === 404;
      }));
    }

    function user(email, password) {
      var defered = Q.defer();
      var authKey;

      if (email === undefined && password === undefined) {
        authKey = store.get("authKey");
      } else {
        authKey = md5(appName + email + password);
      }

      if (authKey) {
        get(authKey + "/profile").then(function(profile) {
          profile = profile ? JSON.parse(profile) : null;

          if (!profile || (email !== undefined && profile.email !== email)) {
            defered.reject("invalid credentials");
          } else {
            store.set("authKey", authKey);

            defered.resolve(buildUserDb(authKey));
          }
        }, defered.reject);
      } else {
        defered.reject("no auth key");
      }

      return defered.promise;
    }

    function register(email, password) {
      var defered = Q.defer();

      var authKey = md5(appName + email + password);

      get(md5(appName + email)).then(function(foundEmail) {
        if (false && foundEmail) {
          defered.reject("account already exists");
        } else {
          return put(md5(appName + email), email).then(function() {
            return put(authKey + "/profile", {
              email: email
            });
          }).then(function() {
              defered.resolve(buildUserDb(authKey));
          }, defered.reject);
        }
      });

      return defered.promise;
    }

    function forEach(target, iterator) {
      if (target.length !== undefined) {
        target.forEach(iterator);
      } else {
        for (var key in target) {
          if (target.hasOwnProperty(key)) {
            iterator(target[key], key);
          }
        }
      }
    }

    function keys(target) {
      var result = [];
      for (var key in target) {
        if (target.hasOwnProperty(key)) {
          result.push(key);
        }
      }
      return result;
    }

    function buildUserDb(authKey) {
      var userDb = {
        deleted: new signals.Signal(),
        inserted: new signals.Signal(),
        updated: new signals.Signal(),
        sync: function() {
          return get(authKey + ".index").then(function(serverIndex) {
            serverIndex = JSON.parse(serverIndex);

            var localIndex = store.get("index") || {};

            var localKeys = keys(localIndex);
            var serverKeys = keys(serverIndex);

            var deletedKeys = localKeys.filter(function(key) {
              return (serverKeys.indexOf(key) === -1);
            });

            forEach(deletedKeys, function(key) {
              store.remove(key);
              delete localIndex[key];
            });

            if (deletedKeys) {
              store.set('index', localIndex);

              forEach(deletedKeys, function(deletedKey) {
                userDb.deleted.dispatch(deletedKey);
              });
            }

            var updatedKeys = [];
            var insertedKeys = [];

            var newTimes = {};

            forEach(serverIndex, function(newTime, key) {
              if (key !== "email") {
                var needsUpdate = false;

                if (localIndex[key] === undefined) {
                  insertedKeys.push(key);
                  needsUpdate = true;
                } else if (localIndex[key] < serverIndex[key]) {
                  updatedKeys.push(key);
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  localIndex[key] = serverIndex[key];
                  newTimes[key] = serverIndex[key];
                }
              }
            });

            var changedKeys = updatedKeys.concat(insertedKeys);

            if (changedKeys.length === 1) {
              return get(authKey + "/" + changedKeys[0]).then(function(result) {
                result = JSON.parse(result);
                var simpleKey = changedKeys[0];


                store.set(simpleKey, result);
                localIndex[simpleKey] = newTimes[simpleKey];

                store.set('index', localIndex);

                forEach(insertedKeys, function(insertedKey) {
                  userDb.inserted.dispatch(store.get(insertedKey), insertedKey);
                });

                forEach(updatedKeys, function(updatedKey) {
                  userDb.updated.dispatch(store.get(updatedKey), updatedKey);
                });

                return newTimes;
              });
            } else if (changedKeys.length > 1) {
              return get(authKey + "/" + changedKeys.join(",") + ".json").then(function(result) {
                result = JSON.parse(result);

                if (changedKeys.length > 1) {
                  forEach(result, function(newValue, key) {
                    var simpleKey = key.substr(authKey.length + 1);
                    var newTime = newTimes[simpleKey];
                    store.set(simpleKey, JSON.parse(result[key]));
                    localIndex[simpleKey] = newTime;
                  });
                } else {
                  var simpleKey = updatedKeys[0];
                  store.set(simpleKey, result);
                  localIndex[simpleKey] = newTimes[simpleKey];
                }

                store.set('index', localIndex);

                forEach(insertedKeys, function(insertedKey) {
                  userDb.inserted.dispatch(store.get(insertedKey), insertedKey);
                });

                forEach(updatedKeys, function(updatedKey) {
                  userDb.updated.dispatch(store.get(updatedKey), updatedKey);
                });

                return newTimes;
              });
            } else {
              return Q.resolve({});
            }
          });
        },
        get: function(key) {
          if (!authKey) return Q.reject("no session");

          var localValue = store.get(key);
          if (localValue === undefined || key === 'email') {
            return get(authKey + "/" + key).then(function(value) {
              if (value === undefined) {
                store.remove(key);
              } else {
                store.set(key, value);
              }
              return value;
            });
          } else {
            return Q.resolve(value);
          }
        },

        put: function(key, value) {
          if (!authKey) return Q.reject("no session");

          var localIndex = store.get("index") || {};

          var newKey = localIndex[key] === undefined;

          return put(authKey + "/" + key, value).then(function() {
            store.set(key, value);
            if (newKey) {
              userDb.inserted.dispatch(value, key);
            } else {
              userDb.updated.dispatch(value, key);
            }
          });
        },

        remove: function(key) {
          return remove(authKey + "/" + key).then(function() {
            var localIndex = store.get("index");
            delete localIndex[key];
            store.remove(key);
            store.set("index", localIndex);

            userDb.deleted.dispatch(key);
          });
        },

        logout: function() {
          var defered = Q.defer();

          if (authKey) {
            store.clear();
            userDb.inserted.removeAll();
            userDb.updated.removeAll();
            userDb.deleted.removeAll();
            authKey = null;
            defered.resolve();

            clearInterval(userDb.syncInterval);
          } else {
            defered.reject("no session");
          }

          return defered.promise;
        },

        isLoggedIn: function() {
          return !!authKey;
        },

        find: function(matcher) {
          var result = {};
          var allStore = store.getAll();

          for (var key in allStore) {
            if (allStore.hasOwnProperty(key)) {
              var value = allStore[key];
              if (matcher(value, key)) {
                result[key] = value;
              }
            }
          }

          return result;
        },

        each: function(iterator) {
          var result = {};
          var allStore = store.getAll();

          for (var key in allStore) {
            if (allStore.hasOwnProperty(key)) {
              iterator(allStore[key], key);
            }
          }

          return result;
        }
      };

      setTimeout(function() {
        userDb.sync();
      }, 0);

      userDb.syncInterval = setInterval(function() {
        userDb.sync();
      }, 10000);

      return userDb;
    }

    return {
      user: user,
      register: register
    }
  };
})();