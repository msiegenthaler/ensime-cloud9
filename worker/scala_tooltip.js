define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");
  var formatting = require("./formatting")

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  var markers = [];
  var updatingMarkers = [];
  var pending = [];

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala tooltip initialized.");

    if (!handler.workspaceDir) {
      handler.workspaceDir = "/home/ubuntu/workspace";
      console.warn("WorkspaceDir was undefined in the language handler - setting it to " + handler.workspaceDir);
    }
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  /** Do multiple concurrent ensime calls. */
  function executeEnsimes(reqs, callback) {
    var done = false;
    var results = [];
    var called = [];

    function cb(index) {
      return function(err, r) {
        if (done || called[index]) return;
        if (err) {
          done = true;
          return callback(err);
        }
        results[index] = r;
        called[index] = true;
        for (var i = 0; i < reqs.length; i++) {
          if (!called[i]) return;
        }
        callback(false, results);
      };
    }
    reqs.forEach(function(req, i) {
      executeEnsime(req, cb(i));
    });
  }


  handler.getTooltipRegex = function() {
    //TODO
    return null;
  };

  handler.tooltip = function(doc, ast, pos, options, callback) {
    console.info("Requesting tooltip for " + handler.path + ":" + JSON.stringify(pos));

    var fileinfo = {
      file: handler.workspaceDir + handler.path,
      currentContents: true
    };
    var point = util.posToOffset(doc, pos);
    var reqs = [{
      typehint: "SymbolAtPointReq",
      file: fileinfo,
      point: point
    }, {
      typehint: "DocUriAtPointReq",
      file: fileinfo,
      point: {
        from: point,
        to: point
      }
    }];
    executeEnsimes(reqs, function(err, results) {
      if (err) return callback(err);
      var symbol = results[0];
      var docUri = results[1];

      console.info(symbol)
      console.info(docUri)

      var hint = "";

      function done(err) {
        if (err) return console.warn(err);
        callback({
          hint: hint,
          pos: {
            sl: pos.row,
            sc: pos.column,
            el: pos.row,
            ec: pos.column
          }
        });
      }

      if (symbol.typehint === "SymbolInfo") {
        hint += util.escapeHtml(symbol.name);
        hint += ": ";
        hint += util.escapeHtml(formatting.formatType(symbol.type));
      }

      if (docUri.typehint === "StringResponse") {
        var url = docUri.text;

        //TODO config plugindir and node
        workerUtil.execFile("node", {
          cwd: "/home/ubuntu/workspace",
          args: [
            "/home/ubuntu/.c9/plugins/c9.ide.language.scala/server/doc-fetcher.js",
            url,
            38871
          ]
        }, function(err, result, stderr) {
          if (err) return done(err);

          if (hint !== "") hint += "<br>";
          hint += "<h4>Documentation</h4>";
          hint += result;
          // hint += "<iframe>"+result+"</iframe>";
          done();
          // console.warn(stdout)
          // hint += `<a onclick="require('ext/preview/preview').preview('${url}'); return false;" href="${url}" target="c9doc" style="pointer-events: auto">(more)</a>`;
        });
      }
      else
        done();
    });
  };
});