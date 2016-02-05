define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;


  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala refactor initialized.");

    if (!handler.workspaceDir) {
      handler.workspaceDir = "/home/ubuntu/workspace";
      console.warn("WorkspaceDir was undefined in the language handler - setting it to " + handler.workspaceDir);
    }
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.getRefactorings = function(doc, ast, pos, options, callback) {
    console.info("Requesting refactorings for " + options.path + ":" + JSON.stringify(pos));

    callback(false, {
      refactoring: ["rename", "organizeImports"],
      isGeneric: false
    });
  };
});