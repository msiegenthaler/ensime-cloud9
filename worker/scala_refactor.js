define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  var refactorId = 0;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala refactor initialized.");

    emitter.on("organiseImports", function(path) {
      organiseImports(path, function(err) {
        if (err) return console.error(err);
      });
    });

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
      refactoring: ["rename", "organiseImports"],
      isGeneric: false
    });
  };

  /** Organize the imports, file must have been saved first. */
  function organiseImports(path, callback) {
    console.info("Will organise the imports for " + path);

    var id = refactorId++;
    executeEnsime({
      typehint: "PrepareRefactorReq",
      procId: id,
      tpe: "ignored",
      params: {
        typehint: "OrganiseImportsRefactorDesc",
        file: handler.workspaceDir + path
      },
      interactive: false
    }, function(err, result) {
      if (err) return callback("Error organising imports: " + err);

      executeEnsime({
          typehint: "ExecRefactorReq",
          procId: id,
          tpe: {
            typehint: "OrganizeImports"
          }
        },
        function(err, res) {
          if (err) return callback("Error organising imports: " + err);
          console.info("Organised imports of " + path);
          callback(false, {});
        });
    });
  }
});