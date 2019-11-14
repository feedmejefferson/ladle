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
const replacer = (key: any, value: any) => {
    if (typeof value === "object" && value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
    }
    return value;
}
const tsRegex = /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+Z$/
const reviver = (key: any, value: any) => {
    if(typeof value === 'string' && value.match(tsRegex)) {
        return admin.firestore.Timestamp.fromDate(new Date(value));
    }
    return value;
}

if (command==='export') {
    // TODO: it would be nice if we created the directory first if it didn't exist
    const results = db.collection(source).get()
    .then(collection => collection.forEach(item => {
        writeFile$(target + '/' + item.id, JSON.stringify(item.data(),replacer))
        .subscribe()
    }))
    .catch(err => console.log(err));
} else if (command==='import') {
    filesInDir$(source).pipe(
        flatMap(x => x),   // flatten the list of files to individual files
    ).subscribe(id => of(id).pipe(  // create a new closure so we can hang on to the file name to use as an id
        map(f => source + '/' + f),   // get the full relative path to the file
        flatMap(f => readFile$(f)),  // unnest the new observable created by readFile$
        map((b => JSON.parse(b.toString(),reviver))),  // convert the buffer to a string and parse it
        ).subscribe(data => {
            const results = db.collection(target).doc(id).set(data)
            .then(x => console.log('success!', x))
            .catch(error => console.log(error));
        }));
} else if (command==='split') {
    // source is a file, target is a folder -- write out one file per object in array
    console.log("split is running")
    readFile$(source).pipe(
        map(b => JSON.parse(b.toString())),
        flatMap(items => of(...items)),
    ).subscribe(item => {
        writeFile$(target + '/' + item.id, JSON.stringify(item))
        .subscribe()
    });
} else if (command==='associate') {
    // source is a file, target is a file -- convert to associative array with nested id as key
    readFile$(source).pipe(
        map(b => JSON.parse(b.toString())),
    ).subscribe(items => {
        const newOb: any = {}
        items.forEach((item: any) => {newOb[item.id]=item} );
        writeFile$(target, JSON.stringify(newOb))
        .subscribe()
    });
} else if (command==='convert') {
    convert(source, target);
} 