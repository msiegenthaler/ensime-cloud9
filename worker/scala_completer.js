define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var formatting = require("./formatting");
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
    console.info("Completion requested for " + handler.path);
    executeEnsime({
      typehint: "CompletionsReq",
      fileInfo: {
        file: handler.workspaceDir + handler.path,
        contents: doc.getValue(),
        currentContents: true
      },
      point: util.posToOffset(doc, pos),
      maxResults: 30,
      caseSens: false,
      reload: true
    }, function(err, result) {
      if (err) return callback(err);

      var names = new Map();
      var completions = result.completions.map(function(r, i) {
        var doc = formatting.formatCompletionsSignature(r.name, r.isCallable, r.typeSig);

        var type;
        if (r.typeSig.result)
          type = r.typeSig.result.replace(/\$$/, "");

        var action = {};
        if (!r.isCallable && type && type.indexOf(".") != -1) {
          //auto add import
          action.addImport = type;
        }

        var obj = {
          id: r.typeId,
          name: r.name,
          replaceText: r.name,
          icon: r.isCallable ? "event" : "property",
          meta: type,
          priority: r.relevance * 100 - i,
          docHead: r.name,
          doc: doc,
          action: action,
          isContextual: true,
          guessTooltip: false
        };
        names.set(obj.name, (names.get(obj.name) || []).concat(obj));
        return obj;
      });

      //Make the names unique, else they get collapsed by c9
      names.forEach(function(es, n) {
        var tps = new Map();
        if (es.length > 1) {
          es.forEach(function(obj, i) {
            var suffix;
            if (!tps.has(obj.meta)) {
              suffix = obj.meta;
              tps.set(obj.meta, true);
              obj.meta = undefined; //no additional information, so leave it out
              obj.name += ` (${suffix})`;
            }
            else {
              //it's really a duplicate, remove it
              completions.splice(completions.indexOf(obj), 1);
            }
          });
        }
      });

      callback(completions);
    });
  };

  handler.predictNextCompletion = function(doc, ast, pos, options, callback) {
    //Trigger an update since our previous results should be refreshed from the server
    // -> higher quality, but more work for the server
    workerUtil.completeUpdate(pos, doc.getLine(pos.row));
  };
});