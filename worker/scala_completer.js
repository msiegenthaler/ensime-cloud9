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
    console.log("Scala completer initialized.");
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }


  handler.complete = function(doc, ast, pos, options, callback) {
    executeEnsime({
      typehint: "CompletionsReq",
      fileInfo: {
        file: ".." + handler.path,
        contents: doc.getValue()
      },
      point: util.posToOffset(doc, pos),
      maxResults: 30,
      caseSens: false,
      reload: true
    }, function(err, result) {
      if (err) return callback(err);

      var completions = result.completions.map(function(r) {
        return {
          id: r.typeId,
          name: r.name,
          replaceText: r.name,
          icon: r.isCallable ? "method" : "property",
          meta: r.typeSig.result,
          priority: r.relevance,
          isContextual: true,
          guessTooltip: false
        };
      });
      callback(completions);
    });
  };
});