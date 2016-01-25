/**
 * Manages the ENSIME process and passes message to/from ENSIME.
 * Incoming:
 *  - set_ensime_config
 *  - start
 *  - stop
 *  - update
 *  - call
 * 
 * Outgoing:
 * - starting
 * - started
 * - stopped
 * - updated
 * - updateFailed
 * - log
 * - event
 * - call.result
 */
define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");

  var node = "/home/ubuntu/.nvm/versions/node/v4.1.1/bin/node";
  var sbt = "/usr/bin/sbt";
  var pluginDir = "/home/ubuntu/.c9/plugins/c9.ide.language.scala";

  var noExecAnalysis = false;

  var handler = module.exports = Object.create(baseHandler);
  var emitter;

  var dotEnsime;
  var ensimeProcess;
  var ensimePort;

  handler.handlesLanguage = function(language) {
    return language === "scala";
  };

  handler.init = function(callback) {
    console.log("Initializing ensime-connector...");
    emitter = handler.getEmitter();

    emitter.on("set_ensime_config", function(config) {
      dotEnsime = config.ensimeFile;
    });

    emitter.on("start", start);
    emitter.on("stop", stop);
    emitter.on("update", update);
    emitter.on("call", call);
    callback();
  };


  function start(attach) {
    console.log("Start requested with attach=" + attach);
    workerUtil.spawn(node, {
      args: [pluginDir + "/server/ensime-runner.js",
        dotEnsime, sbt,
        attach.toString()
      ]
    }, function(err, process) {
      if (err) return console.error(err);
      ensimeProcess = process;
      console.log("Waiting for ENSIME to start...");
      emitter.emit("starting");

      process.stdout.on("data", function(chunk) {
        //TODO chunk to message mapping might not always be 1:1
        console.debug("ENSIME-EVENT: " + chunk);
        var event = JSON.parse(chunk);
        if (event.type === "started") {
          console.log("ENSIME started.");
          ensimePort = event.port;
          emitter.emit("started");
        }
        else {
          emitter.emit("event", event);
        }
      });
      process.stderr.on("data", function(chunk) {
        emitter.emit("log", chunk);
      });
      process.on("exit", function(code) {
        emitter.emit("stopped", code);
        ensimeProcess = undefined;
        ensimePort = undefined;
        console.log("Ensime server stopped (code " + code + ")");
      });
    });
  }

  function stop() {
    if (ensimeProcess)
      ensimeProcess.kill();
    ensimeProcess = undefined;
    ensimePort = undefined;
    emitter.emit("stopped", -1);
  }

  function update() {
    workerUtil.spawn(node, {
      args: [pluginDir + "/server/ensime-update.js",
        dotEnsime, sbt
      ]
    }, function(err, process) {
      if (err) return console.error(err);
      ensimeProcess = undefined;
      ensimePort = undefined;
      console.log("Waiting for ENSIME to update...");
      emitter.emit("stopped");
      emitter.emit("updating");

      process.stdout.on("data", function(chunk) {
        //TODO chunk to message mapping might not always be 1:1
        console.debug("ENSIME-EVENT: " + chunk);
        var event = JSON.parse(chunk);
        if (event.type === "updated") {
          console.log("ENSIME updated.");
          emitter.emit("updated");
        }
      });
      process.stderr.on("data", function(chunk) {
        emitter.emit("log", chunk);
      });
      process.on("exit", function(code) {
        if (code != 0) {
          emitter.emit("updateFailed", "Code: " + code);
          console.log("Ensime update failed (code " + code + ")");
        }
      });
    });

  }

  function call(request) {
    if (!ensimePort)
      return console.warn("Could not execute call to ENSIME, since it is not running.");

    console.debug("ENSIME-REQ:  " + JSON.stringify(request));

    function handler(err, data, stderr) {
      var result = {
        id: request.id
      };
      if (err) {
        result.error = "Call failed: " + JSON.stringify(err);
        result.stderr = stderr;
      }
      else {
        if (typeof data === "string") {
          result.result = JSON.parse(data);
        }
        else result.result = data;
      }
      console.debug("ENSIME-RESP: " + JSON.stringify(result));
      emitter.emit("call.result", result);
    }

    if (noExecAnalysis && request.request.fileInfo && request.request.fileInfo.currentContents) {
      delete request.request.fileInfo.currentContents;
      workerUtil.readFile(request.request.fileInfo.file, {
        encoding: "utf-8",
        allowUnsaved: true
      }, function(err, contents) {
        if (err) return handler(err);
        request.request.fileInfo.contents = contents;
        call(JSON.stringify(request.request));
      });
    }
    else call(JSON.stringify(request.request));

    function call(data) {
      if (request.request.fileInfo && request.request.fileInfo.currentContents) {
        workerUtil.execAnalysis(node, {
          args: [
            pluginDir + "/server/ensime-caller.js",
            ensimePort,
            data
          ],
          mode: "stdin",
          json: false,
          semaphore: request.id,
          maxCallInterval: 1
        }, handler);
      }
      else {
        workerUtil.execFile("node", {
          args: [
            pluginDir + "/server/ensime-caller.js",
            ensimePort,
            data
          ],
        }, handler);
      }
    }
  }
});