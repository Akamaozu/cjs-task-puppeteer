// USES
// - task variables: [ 'browser-page' ]

module.exports = function( task, config ){

  if( ! config ) config = {};
  if( typeof config.url !== 'string' ) return task.end( new Error( 'no page url given to navigate to' ) );

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

  task.step( 'load new page in browser', function(){
    var page = task.get( 'browser-page' );

    if( ! page ) throw new Error( 'no browser page instance stored -- are you sure browser has been started?' );
    if( config.verbose ) console.log( ' - [browser][page] navigating to "' + config.url + '"' );

    page.goto( config.url )
      .then( function(){
        // when page loads, next task will be triggered
        // no need to do anything here :)
      })
      .catch( function( e ){
        return task.end( e );
      });
  });
}