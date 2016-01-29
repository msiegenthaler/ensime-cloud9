define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");

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

  handler.getTooltipRegex = function() {
    //TODO
    return null;
  };


  handler.tooltip = function(doc, ast, pos, options, callback) {
    console.info("Requesting tooltip for " + handler.path + ":" + JSON.stringify(pos));

    executeEnsime({
      typehint: "DocUriAtPointReq",
      file: {
        file: handler.workspaceDir + handler.path,
        currentContents: true
      },
      point: {
        from: util.posToOffset(doc, pos),
        to: util.posToOffset(doc, pos)
      }
    }, function(err, result) {
      if (err) {
        console.error("Could not get the tooltip: " + err);
        return callback();
      }
      if (result.typehint === "StringResponse") {
        console.warn(result.text);
      }
      else {
        console.warn("no doc");
      }
      callback({
        hint: "This is a <b>tooltip</b>",
        // signatures: [{
        // name: "Test"
        // }],
        pos: {
          sl: cursorPos.row,
          sc: cursorPos.column,
          el: cursorPos.row,
          ec: cursorPos.column
        }
      });
    });
  };
});