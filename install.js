define(function(require, exports, module) {
  module.exports = function(session, options) {
    session.install({
      "name": "Oracle Java 8 Installer",
      "description": "Installs Java 8 from Oracle",
      "cwd": "~/.c9"
    }, [{
      "bash": "sudo add-apt-repository ppa:webupd8team/java -y"
    }, {
      "bash": "sudo apt-get -y update"
    }, {
      "bash": "sudo echo oracle-java7-installer shared/accepted-oracle-license-v1-1 select true | sudo /usr/bin/debconf-set-selections"
    }, {
      "bash": "sudo apt-get -y install oracle-java8-installer"
    }]);

    session.install({
      "name": "SBT",
      "description": "Installs SBT to run scala",
      "cwd": "~/.c9"
    }, [{
      "ubuntu": "apt-transport-https"
    }, {
      "bash": 'sudo echo "deb https://dl.bintray.com/sbt/debian /" | sudo tee -a /etc/apt/sources.list.d/sbt.list'
    }, {
      "bash": "sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 642AC823"
    }, {
      "bash": "sudo apt-get -y update"
    }, {
      "bash": "sudo apt-get -y install sbt"
    }]);
    
    session.install({
      "name": "ensime-controller-js",
      "description": "Controls the ensime process on the server.",
      "cwd": "~/.c9"
    }, {
      "npm": "ensime-controller-js"
    });

    session.start();
  };

  // version of the installer. Increase this when installer changes and must run again
  module.exports.version = 3;
});