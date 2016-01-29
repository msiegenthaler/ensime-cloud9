define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");
  var util = require("./util");

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  var markers = [];
  var updatingMarkers = [];
  var pending = [];

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    emitter = handler.getEmitter();
    console.log("Scala markers initialized.");
    emitter.on("event", handleEvent);
    emitter.on("afterSave", handleSave);
    emitter.on("rebuild", function() {
      console.info("Refreshing all markers..");
      workerUtil.refreshAllMarkers();
    });
    emitter.on("refreshMarkers", function() {
      emitter.emit("markers", markers);
      workerUtil.refreshAllMarkers();
    });
    if (!handler.workspaceDir) {
      handler.workspaceDir = "/home/ubuntu/workspace";
      console.warn("WorkspaceDir was undefined in the language handler - setting it to " + handler.workspaceDir);
    }
    callback();
  };

  function handleEvent(event) {
    if (event.typehint === "NewScalaNotesEvent") {
      if (event.isFull) updatingMarkers = [];
      updatingMarkers = updatingMarkers.concat(event.notes.map(toMarker));
    }
    else if (event.typehint === "ClearAllScalaNotesEvent") {
      updatingMarkers = [];
    }
    else if (event.typehint === "FullTypeCheckCompleteEvent") {
      //Typecheck done, now send the markers to the callbacks
      markers = updatingMarkers;
      updatingMarkers = [];
      emitter.emit("markers", markers);
      emitter.emit("done");
      pending.forEach(function(p) {
        p();
      });
      pending = [];
    }
  }

  function handleSave(path) {
    //Force a check the file
    console.info("Forcing typecheck of " + path);
    executeEnsime({
      typehint: "TypecheckFileReq",
      fileInfo: {
        file: handler.workspaceDir + path,
      }
    }, function() {
      //we'll wait for typecheck to complete
    });
  }

  function toMarker(note) {
    var res = {
      pos: {
        sl: note.line - 1,
        sc: note.col,
        el: note.line - 1,
        ec: note.col
      },
      type: serverityToType(note.severity),
      message: note.msg
    };
    if (note.file.indexOf(handler.workspaceDir) == 0) {
      res.file = note.file.substr(handler.workspaceDir.length);
    }
    else {
      console.warn("File not in workspace: " + note.file + " (workspaceDir is " + handler.workspaceDir + ")");
      res.file = note.file;
    }
    res.fileFull = note.file;
    return res;
  }

  function serverityToType(severity) {
    switch (severity.typehint) {
      case "NoteInfo":
        return "info";
      case "NoteWarn":
        return "warning";
      case "NoteError":
        return "error";
      default:
        return "error";
    }
  }

  function executeEnsime(req, callback) {
    util.executeEnsime(emitter, req, callback);
  }

  handler.analyze = function(doc, ast, options, callback) {
    var file = handler.path;
    var hadError = false;

    function callCallback() {
      if (hadError) return;
      var ms = markers.filter(function(m) {
        return m.file === file;
      });
      callback(false, ms);
    }

    if (options.minimalAnalysis) {
      // fast track with the current state of the markers
      return callCallback();
    }

    executeEnsime({
      typehint: "TypecheckFileReq",
      fileInfo: {
        file: handler.workspaceDir + handler.path,
        currentContents: true
      }
    }, function(err) {
      if (err) {
        workerUtil.showError("Problem updating the markers");
        hadError = true;
        return callback(err);
      }
      //we'll wait for typecheck to complete
    });

    //defer the answer until the typecheck is done.
    if (pending.length == 0) emitter.emit("working");
    pending.push(callCallback);
  };
});