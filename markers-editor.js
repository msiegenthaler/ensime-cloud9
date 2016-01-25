define(function(require, exports, module) {
    module.exports = function(imports, consumes) {
        var Editor = imports.Editor;
        var Datagrid = imports.Datagrid;
        var ensime = imports.ensime;
        var path = require("path");


        function MarkersEditor() {
            console.log("initializing Scala MarkersEditor.");

            var workspaceDir = undefined;

            var plugin = new Editor("Ensime", consumes, []);
            plugin.on("draw", function(e) {
                var container = e.htmlNode;
                var table = new Datagrid({
                    container: container,

                    columns: [{
                        caption: "Message",
                        value: "message",
                        width: "60%",
                    }, {
                        caption: "Severity",
                        value: "type",
                        width: "150",
                    }, {
                        caption: "Location",
                        getText: function(marker) {
                            var name = path.basename(marker.file, ".scala");
                            var dir;
                            if (workspaceDir)
                                dir = path.relative(workspaceDir, marker.file).substr(1);
                            else
                                dir = marker.file;
                            var line = marker.pos.sl;
                            return `${name}:${line} (${dir})`;
                        },
                        width: "30%"
                    }],

                    sort: function(markers) {
                        function sn(severity) {
                            switch (severity) {
                                case "error":
                                    return 100;
                                case "warning":
                                    return 10;
                                case "info":
                                    return 1;
                                default:
                                    return 0;
                            }
                        }

                        function order(a, b) {
                            var asn = sn(a.type);
                            var bsn = sn(b.type);
                            if (asn > bsn) return -1;
                            if (asn < bsn) return 1;
                            if (a.file < b.file) return -1;
                            if (a.file > b.file) return 1;
                            if (a.pos.sl < b.pos.sl) return -1;
                            if (a.pos.sl > b.pos.sl) return 1;
                            if (a.message == b.message) return 0;
                            return -1;
                        }
                        return markers.sort(order);
                    }
                }, plugin);

                ensime.on("markers", function(markers) {
                    table.setRoot(markers);
                }, plugin);
            });

            plugin.on("config", function(config) {
                workspaceDir = config.workspaceDir;
            });

            plugin.on("load", function() {
                console.info("Loading Scala Markers Editor...");
            });

            plugin.on("documentLoad", function(e) {
                var doc = e.doc;
                doc.title = "Errors and Warnings";
                doc.meta.ensimeMarkersEditor = true;
            });

            plugin.freezePublicAPI({});
            plugin.load(null, "ensimeMarkers");
            return plugin;
        }

        return MarkersEditor;
    };
});