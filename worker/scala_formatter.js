define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();

    if (!handler.workspaceDir) {
      handler.workspaceDir = "/home/ubuntu/workspace";
      console.warn("WorkspaceDir was undefined in the language handler - setting it to " + handler.workspaceDir);
    }

    console.log("Scala formatter initialized.");
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.codeFormat = function(doc, callback) {
    console.log("Code Format called for " + handler.path);
    executeEnsime({
      typehint: "FormatOneSourceReq",
      file: {
        file: handler.workspaceDir + handler.path,
        currentContents: true
      }
    }, function(err, result) {
      if (err) {
        workerUtil.showError("Could not format the code");
        return callback(err);
      }
      callback(false, result.text);
    });
  };
});