define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");
  var pathUtil = require("path");

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
        if (err) {
          workerUtil.showError("Problem while organising the imports");
          return console.error(err);
        }
      });
    });

    emitter.on("addImport", function(e) {
      addImport(e.path, e.add, function(err) {
        if (err) {
          workerUtil.showError("Problem while adding an import");
          return console.error(err);
        }
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
      refactoring: ["rename", "organiseImports", "addImport"],
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
      if (err) return callback(err);

      executeEnsime({
          typehint: "ExecRefactorReq",
          procId: id,
          tpe: {
            typehint: "OrganizeImports"
          }
        },
        function(err, res) {
          if (err) return callback(err);
          console.info("Organised imports of " + path);
          callback(false, {});
        });
    });
  }

  /** Add an import. The file must have been saved first. */
  function addImport(path, importToAdd, callback) {
    console.info(`Will add import ${importToAdd} for ${path}`);

    var id = refactorId++;
    executeEnsime({
      typehint: "PrepareRefactorReq",
      procId: id,
      tpe: "ignored",
      params: {
        typehint: "AddImportRefactorDesc",
        file: handler.workspaceDir + path,
        qualifiedName: importToAdd
      },
      interactive: true
    }, function(err, result) {
      if (err) return callback(err);

      console.warn(result)

      if (result.typehint === "RefactorEffect") {
        emitter.emit("updateEditor", result.changes.map(function(change) {
          return {
            path: "/" + pathUtil.relative(handler.workspaceDir, change.file),
            from: change.from,
            to: change.to,
            text: change.text
          };
        }));
        
        //Cancel refactor request, we'll apply it ourselves
        executeEnsime({
            typehint: "ExecRefactorReq",
            procId: id,
            tpe: {
              typehint: "AddImport"
            }
          },
          function(err, res) {
            if (err) return callback(err);
            console.info(`Added import ${importToAdd} to ${path}`);

            callback(false, {});
          });
      }
    });
  }
});