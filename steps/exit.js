// USES
// - task variables: [ 'browser' ]

module.exports = function( task, config ){

  if( ! config ) config = {};

  // determine logging verbosity
    var set_logging_verbosity = false;

    if( ! set_logging_verbosity && config.hasOwnProperty( 'verbose' ) ){
      config.verbose = config.verbose;
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity && process.env.hasOwnProperty( 'BROWSER_VERBOSE_LOGGING' ) ){
      config.verbose = process.env.BROWSER_VERBOSE_LOGGING.toLowerCase().trim() !== 'false';
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity && process.env.hasOwnProperty( 'VERBOSE_LOGGING' ) ){
      config.verbose = process.env.VERBOSE_LOGGING.toLowerCase().trim() !== 'false';
      set_logging_verbosity = true;
    }

    if( ! set_logging_verbosity ) config.verbose = true;

  task.step( 'exit browser', function(){
    var browser = task.get( 'browser' );
    if( ! browser ) return task.end( new Error( 'no browser instance found' ) );

    if( config.verbose ) console.log( ' - [browser] shutdown' );

    browser.close();
    task.next();
  });
}