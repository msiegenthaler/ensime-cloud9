define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    emitter.on("set_scala_config", function(e) {
      console.log("settings are: " + JSON.stringify(e.data));
    });
    console.log("Scala completer initialized.");
    callback();
  };


  function calcPoint(doc, pos) {
    return doc.getLines(0, pos.row - 1).reduce(function(sf, l) {
      return sf + l.length + 1;
    }, 0) + pos.column;
  }


  handler.complete = function(doc, ast, pos, options, callback) {
    callEnsime({
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

      console.log(result);
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
      console.log(completions);
      callback(completions);
    });
  };

  handler.tooltip = function(doc, ast, pos, options, callback) {
    console.log("Requesting tooltip info");
    // There seems to be some problem with ensime atm, it returns a 500
    callEnsime({
      //typehint: "TypecheckAllReq"

      typehint: "SymbolAtPointReq",
      file: {
        file: ".." + handler.path,
        contents: doc.getValue()
      },
      point: calcPoint(doc, pos)

      // typehint: "ConnectionInfoReq"
    }, function(err, result) {
      if (err) return callback(err);
      // console.log("Got ensime result");
      // console.log(result);
      // 
      callback(undefined, {
        hint: "Hello there!"
      });
    });
  };




  var last_id = 0;

  function callEnsime(req, callback) {
    var reqId = last_id++;

    emitter.on("callEnsime.result", function hdlr(event) {
      if (event.to !== reqId) return;
      handler.sender.off("callEnsime.result", hdlr);
      callback(event.err, event.result);
    });

    emitter.emit("callEnsime", {
      id: reqId,
      request: req
    });
  }
});