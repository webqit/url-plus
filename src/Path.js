export const Path = {
    join(/* path segments */) {
        // Split the inputs into a list of path commands.
        let parts = [], backsteps = 0;
        for ( let i = 0, l = arguments.length; i < l; i++ ) {
            parts = parts.concat( arguments[ i ].split( '/' ) );
        }
        // Interpret the path commands to get the new resolved path.
        let newParts = [];
        for ( let i = 0, l = parts.length; i < l; i++ ) {
            let part = parts[ i ];
            // Remove leading and trailing slashes
            // Also remove "." segments
            if ( !part || part === '.' ) continue;
            // Interpret ".." to pop the last segment
            if ( part === '..' ) {
                if ( !newParts.length ) backsteps ++;
                else newParts.pop();
            }
            // Push new path segments.
            else newParts.push( part );
        }
        // Preserve the initial slash if there was one.
        if ( parts[ 0 ] === '' ) newParts.unshift( '' );
        // Turn back into a single string path.
        return '../'.repeat( backsteps ) + newParts.join( '/' ) || ( newParts.length ? '/' : '.' );
    },
    // A simple function to get the dirname of a path
    // Trailing slashes are ignored. Leading slash is preserved.
    dirname( path ) {
        return this.join( path, '..' );
    }
};