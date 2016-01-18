define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;
  var call_id_prefix = "completer";
  var last_call_id = 0;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala completer initialized.");
    callback();
  };

  function executeEnsime(req, callback) {
    var reqId = call_id_prefix + (last_call_id++);
    emitter.on("call.result", function hdlr(event) {
      if (event.id !== reqId) return;
      emitter.off("call.result", hdlr);
      callback(event.error, event.result);
    });
    emitter.emit("call", {
      id: reqId,
      request: req,
    });
  }

  function calcPoint(doc, pos) {
    return doc.getLines(0, pos.row - 1).reduce(function(sf, l) {
      return sf + l.length + 1;
    }, 0) + pos.column;
  }

  handler.complete = function(doc, ast, pos, options, callback) {
    executeEnsime({
      typehint: "CompletionsReq",
      fileInfo: {
        file: ".." + handler.path,
        contents: doc.getValue()
      },
      point: calcPoint(doc, pos),
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

  /*
    handler.tooltip = function(doc, ast, pos, options, callback) {
      console.log("Requesting tooltip info");
      //TODO There seems to be some problem with ensime atm, it returns a 500
      executeEnsime({
        typehint: "SymbolAtPointReq",
        file: {
          file: ".." + handler.path,
          contents: doc.getValue()
        },
        point: calcPoint(doc, pos)
      }, function(err, result) {
        if (err) return callback(err);
        console.log(result);

        callback(undefined, {
          hint: "Hello there!"
        });
      });
    };
  */
});