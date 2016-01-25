Scala plugin for Cloud9
=======================

Provides advanced Scala language features based on *ensime*.


Supported features
------------------
- Code completions
- Show compile errors and warnings as markers
- Outline


Installation
------------
- Create a Cloud9 workspace (custom)
- Go to preferences -> experimental and enable "Load plugins from workspace"
- Execute "c9 install c9.ide.language.scala" in the terminal. You might have to provide your login credentials.
- Reload the workspace
- Wait until the installation of the dependencies is completed. Unfortunatly Cloud9 does not provide any
  indication about the progress, so you need to check via the command line. As soon as the 'sbt' command is available, the installation is complete.
- execute "sbt gen-ensime" in your workspace. You must have an sbt-based project checked out before.
- reload the workspace, ENSIME should now be installed and started. Check the browser console about the progress (should take about
  5 minutes).
- Scala support is now ready.


References
----------
- https://github.com/ensime/ensime-server