define(function(require, exports, module) {

  var call_id_prefix = "completer";
  var last_call_id = 0;

  function executeEnsime(emitter, req, callback) {
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

  module.exports = {
    executeEnsime: executeEnsime,
    calcPoint: calcPoint
  };
});