import admin from 'firebase-admin';
import fs from 'fs';
import minimist from 'minimist';
import { Observable, bindNodeCallback, of, range, pipe } from 'rxjs';
import { map, tap, switchMap, flatMap, share, zip, delay } from 'rxjs/operators';
import { convert } from './convert-legacy';


var args = minimist(process.argv.slice(2), {
      string: 'cert',
      default: { cert: './serviceAccountKey.json' }
//    string: 'lang',           // --lang xml
//    boolean: ['version', 'stuff'],     // --version
//    alias: { v: 'version', s: 'stuff' } 
  });
  
admin.initializeApp({
    credential: admin.credential.cert(args.cert)
})

const command = args._[0]; // import or export
// depending on import or export, the source and target are either a firestore
// collection or a local folder
const source = args._[1]; 
const target = args._[2]; 
const db = admin.firestore();

const filesInDir$ = bindNodeCallback(fs.readdir);
const readFile$ = bindNodeCallback(fs.readFile);
const writeFile$ = bindNodeCallback(fs.writeFile);

if (command==='export') {
    // TODO: it would be nice if we created the directory first if it didn't exist
    const results = db.collection(source).get()
    .then(collection => collection.forEach(item => {
        writeFile$(target + '/' + item.id, JSON.stringify(item.data()))
        .subscribe()
    }))
    .catch(err => console.log(err));
} else if (command==='import') {
    filesInDir$(source).pipe(
        flatMap(x => x),   // flatten the list of files to individual files
    ).subscribe(id => of(id).pipe(  // create a new closure so we can hang on to the file name to use as an id
        map(f => source + '/' + f),   // get the full relative path to the file
        flatMap(f => readFile$(f)),  // unnest the new observable created by readFile$
        map((b => JSON.parse(b.toString()))),  // convert the buffer to a string and parse it
        ).subscribe(data => {
            const results = db.collection(target).doc(id).set(data)
            .then(x => console.log('success!', x))
            .catch(error => console.log(error));
        }));

} else if (command==='convert') {
    convert(source, target);
} 