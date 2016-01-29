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

    //TODO Temporary, until the bug in worker.codeFormat is fixed.
    emitter.on("format", function(editor) {
      handler.codeFormat(handler.doc, function(err, value) {
        if (err) return console.error("Formatting failed: " + err);
        console.log("updating value: " + value);
        emitter.emit("code_format", {
          path: handler.path,
          value: value
        });
      });
    });

    console.log("Scala formatter initialized.");
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.codeFormat = function(doc, callback) {
    console.log("Code Format called for " + handler.path);
    var content = doc.getValue();
    //TODO format
    callback(false, content + "!");
  };
});