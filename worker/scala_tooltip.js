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

    executeEnsime({
      typehint: "SymbolAtPointReq",
      file: {
        file: handler.workspaceDir + handler.path,
        currentContents: true
      },
      point: util.posToOffset(doc, pos)
    }, function(err, symbol) {
      if (err) {
        console.warn("Error fetching tooltip (SymbolAtPointReq).");
        return callback({});
      }
      if (symbol.typehint !== "SymbolInfo") return callback(false, {});

      console.info(symbol)

      var hint = util.escapeHtml(symbol.name);
      hint += ": ";
      hint += util.escapeHtml(formatting.formatType(symbol.type));

      //TODO config plugindir and node
      workerUtil.execFile("node", {
        cwd: "/home/ubuntu/workspace",
        args: [
          "/home/ubuntu/.c9/plugins/c9.ide.language.scala/server/doc-fetcher.js",
          JSON.stringify(symbol.declPos)
        ]
      }, function(err, result, stderr) {
        if (err) {
          console.warn("Error fetching tooltip (doc-fetcher): " + stderr);
          return callback({});
        }

        if (result && result.length > 1) {
          hint += '<div style="border-top: 1px solid grey; margin-top: 1em; padding-top: 0.5em; margin-bottom: 0.5em;">';
          hint += workerUtil.filterDocumentation(result);
          hint += "</div>";
        }

        //TODO maybe use preview for that...
        // hint += `<a onclick="require('ext/preview/preview').preview('${url}'); return false;" href="${url}" target="c9doc" style="pointer-events: auto">(more)</a>`;

        callback({
          hint: hint,
          pos: {
            sl: pos.row,
            sc: pos.column,
            el: pos.row,
            ec: pos.column
          }
        });
      });
    });
  };
});