/**
 * Manages the ENSIME process and passes message to/from ENSIME.
 * Incoming:
 *  - set_ensime_config
 *  - start
 *  - stop
 *  - call
 * 
 * Outgoing:
 * - starting
 * - started
 * - stopped
 * - log
 * - event
 */
define(function(require, exports, module) {

  var baseHandler = require("plugins/c9.ide.language/base_handler");
  var workerUtil = require("plugins/c9.ide.language/worker_util");

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
    callback();
  };


  function start() {
    console.log("Start requested.");
    workerUtil.spawn("/home/ubuntu/.nvm/versions/node/v4.1.1/bin/node", {
      args: ["../.c9/plugins/ensime.language.scala/server/ensime-runner.js",
        dotEnsime
      ]
    }, function(err, process) {
      if (err) return console.error(err);
      ensimeProcess = process;
      console.log("Waiting for ENSIME to start...");
      emitter.emit("starting");

      process.stdout.on("data", function(chunk) {
        //TODO chunk to message mapping might not always be 1:1
        console.log("ENSIME-EVENT: " + chunk);
        var event = JSON.parse(chunk);
        if (event.type === "started") {
          console.log("ENSIME started.");
          ensimePort = event.port;
          emitter.emit("started");
        } else {
          emitter.emit("event", event);
        }
      });
      process.stderr.on("data", function(chunk) {
        emitter.emit("log", chunk);
      });
      process.on("exit", function(code) {
        emitter.emit("stopped", code);
        console.log("Ensime server stopped (code " + code + ")");
      });
    });
  }

  function stop() {
    if (ensimeProcess)
      ensimeProcess.kill();
    emitter.emit("stopped", -1);
  }
});