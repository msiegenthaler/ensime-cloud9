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

  handler.tooltip = function(doc, ast, cursorPos, options, callback) {
    console.log("Requesting tooltip info");
    // callEnsime({
    //   typehint: "SymbolAtPointReq",
    //   file: "~/workspace/src/main/scala/example/Usage.scala",
    //   point: 123
    // callEnsime({
    //   typehint: "CompletionsReq",
    //   fileInfo: {
    //     file: "~/workspace/src/main/scala/example/Usage.scala",
    //     contents: "object A { def a(v: String) = v. }"
    //   },
    //   point: 16,
    //   maxResults: 10,
    //   caseSens: false,
    //   reload: true
    // }, function(err, result) {
    // callEnsime({
    //   typehint: "TypecheckAllReq"
    // }, function(err, result) {
    callEnsime({
      typehint: "ConnectionInfoReq"
    }, function(err, result) {

      if (err) return console.error("Call to ensime-server failed: " + err);
      console.log("Got ensime result");
      console.log(result);
    });


    callback(undefined, {
      hint: "Hello there!"
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