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
    console.log("Scala jump-to-definition initialized.");

    if (!handler.workspaceDir) {
      handler.workspaceDir = "/home/ubuntu/workspace";
      console.warn("WorkspaceDir was undefined in the language handler - setting it to " + handler.workspaceDir);
    }
    callback();
  };

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.jumpToDefinition = function(doc, ast, pos, callback) {
    console.info("Jump to definition for " + handler.path + ":" + JSON.stringify(pos));

    executeEnsime({
      typehint: "SymbolAtPointReq",
      file: {
        file: handler.workspaceDir + handler.path,
        currentContents: true
      },
      point: util.posToOffset(doc, pos)
    }, function(err, symbol) {
      if (err) {
        console.warn("Error fetching jumping to definition (SymbolAtPointReq).");
        return callback({});
      }
      if (symbol.typehint !== "SymbolInfo") return callback(false, []);

      console.warn("TODO: Jump to " + JSON.stringify(symbol.declPos))
      callback([]);
    });
  };
});