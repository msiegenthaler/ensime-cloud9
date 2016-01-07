define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");

  var handler = module.exports = Object.create(baseHandler);

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    var emitter = handler.getEmitter();
    emitter.on("set_scala_config", function(e) {});
    console.log("Scala completer initialized.");
    callback();
  };

});