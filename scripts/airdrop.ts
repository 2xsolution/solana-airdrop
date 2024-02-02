import {
    clusterApiUrl,
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    Transaction,
    PublicKey,
    ConfirmOptions,
} from '@solana/web3.js';

import {
  createWithdrawWithheldTokensFromAccountsInstruction,
} from '../src/extensions/transferFee/instructions.js';
import { createAssociatedTokenAccountInstruction } from '../src/instructions/associatedTokenAccount.js';
import {
 
  TokenOwnerOffCurveError,
} from '../src/errors.js';
import * as fs from 'fs';

import * as web3 from '@solana/web3.js';
import path from "path";
import fetch from 'node-fetch';

import {
    createAccount,
    getTransferFeeAmount,
    unpackAccount,
    TOKEN_2022_PROGRAM_ID,
} from '../src';
import { createClient } from '@supabase/supabase-js'
import { getSigners } from '../src/actions/internal.js';


// define some default locations
const DEFAULT_KEY_DIR_NAME = ".local_keys";
const DEFAULT_PUBLIC_KEY_FILE = "keys.json";
let BASE_URL = 'https://vcyjfiydthlzwmfibwzy.supabase.co/';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjeWpmaXlkdGhsendtZmlid3p5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNjEyMTg5MywiZXhwIjoyMDIxNjk3ODkzfQ.Q16oFKazewDmHI8pYKs5MD7opsVHin5rHHHKF4dj4ck';
const no_of_tx= 4; //minimum no of tx required to perform a airdrop
const apiUrl= "https://devnet.helius-rpc.com/?api-key=6a4ed357-da30-43e6-a5ac-c1c70c457024" //RPC URL
const connection = new Connection(clusterApiUrl(apiUrl), 'confirmed');

let payer = loadWalletKey("C://id.json"); //Provide path to your token owner json file
console.log("Payer : " , payer.publicKey.toBase58());    

let mint = new PublicKey("AxgNYEcytcMvfWhL3mQVbw1xQuzQN179wLfYDPrynbvt"); //provide your token mint ID
 
// Create a single supabase client for interacting with your database
const supabase = createClient(BASE_URL, API_KEY);

export function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  programId = TOKEN_2022_PROGRAM_ID,
  associatedTokenProgramId = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
): PublicKey {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) throw new TokenOwnerOffCurveError();

  const [address] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
      associatedTokenProgramId
  );

  return address;
}

/*
  Load locally stored PublicKey addresses
*/
export function loadPublicKeysFromFile(
  absPath: string = `${DEFAULT_KEY_DIR_NAME}/${DEFAULT_PUBLIC_KEY_FILE}`,
) {
  try {
    if (!absPath) throw Error("No path provided");
    if (!fs.existsSync(absPath)) throw Error("File does not exist.");

    // load the public keys from the file
    const data = JSON.parse(fs.readFileSync(absPath, { encoding: "utf-8" })) || {};

    // convert all loaded keyed values into valid public keys
    for (const [key, value] of Object.entries(data)) {
      data[key] = new PublicKey(value as string) ?? "";
    }

    return data;
  } catch (err) {
    // console.warn("Unable to load local file");
  }
  // always return an object
  return {};
}


/*
  Locally save a PublicKey addresses to the filesystem for later retrieval
*/
export function savePublicKeyToFile(
  name: string,
  publicKey: PublicKey,
  absPath: string = `${DEFAULT_KEY_DIR_NAME}/${DEFAULT_PUBLIC_KEY_FILE}`,
) {
  try {
    // if (!absPath) throw Error("No path provided");
    // if (!fs.existsSync(absPath)) throw Error("File does not exist.");

    // fetch all the current values
    let data: any = loadPublicKeysFromFile(absPath);

    // convert all loaded keyed values from PublicKeys to strings
    for (const [key, value] of Object.entries(data)) {
      data[key as any] = (value as PublicKey).toBase58();
    }
    data = { ...data, [name]: publicKey.toBase58() };

    // actually save the data to the file
    fs.writeFileSync(absPath, JSON.stringify(data), {
      encoding: "utf-8",
    });

    // reload the keys for sanity
    data = loadPublicKeysFromFile(absPath);

    return data;
  } catch (err) {
    console.warn("Unable to save to file");
  }
  // always return an object
  return {};
}

/*
  Load a locally stored JSON keypair file and convert it to a valid Keypair
*/
export function loadKeypairFromFile(absPath: string) {
  try {
    if (!absPath) throw Error("No path provided");
    if (!fs.existsSync(absPath)) throw Error("File does not exist.");

    // load the keypair from the file
    const keyfileBytes = JSON.parse(fs.readFileSync(absPath, { encoding: "utf-8" }));
    // parse the loaded secretKey into a valid keypair
    const keypair = Keypair.fromSecretKey(new Uint8Array(keyfileBytes));
    return keypair;
  } catch (err) {
    // return false;
    throw err;
  }
}

/*
  Save a locally stored JSON keypair file for later importing
*/
export function saveKeypairToFile(
  keypair: Keypair,
  fileName: string,
  dirName: string = DEFAULT_KEY_DIR_NAME,
) {
  fileName = path.join(dirName, `${fileName}.json`);

  // create the `dirName` directory, if it does not exists
  if (!fs.existsSync(`./${dirName}/`)) fs.mkdirSync(`./${dirName}/`);

  // remove the current file, if it already exists
  if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

  // write the `secretKey` value as a string
  fs.writeFileSync(fileName, `[${keypair.secretKey.toString()}]`, {
    encoding: "utf-8",
  });

  return fileName;
}

/*
  Attempt to load a keypair from the filesystem, or generate and save a new one
*/
export function loadOrGenerateKeypair(fileName: string, dirName: string = DEFAULT_KEY_DIR_NAME) {
  try {
    // compute the path to locate the file
    const searchPath = path.join(dirName, `${fileName}.json`);
    let keypair = Keypair.generate();

    // attempt to load the keypair from the file
    if (fs.existsSync(searchPath)) keypair = loadKeypairFromFile(searchPath);
    // when unable to locate the keypair, save the new one
    else saveKeypairToFile(keypair, fileName, dirName);

    return keypair;
  } catch (err) {
    console.error("loadOrGenerateKeypair:", err);
    throw err;
  }
}

export function loadWalletKey(keypairFile:string): web3.Keypair {
    if (!keypairFile || keypairFile == '') {
      throw new Error('Keypair is required!');
    }
    const loaded = web3.Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypairFile).toString())),
    );
    return loaded;
  }


(async () => {
  const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: 'confirmed',
    filters: [
        {
            memcmp: {
                offset: 0,
                bytes: mint.toString(),
            },
        },
    ],
});


let accountsToWithdrawFrom :PublicKey[]= [];
for (const accountInfo of allAccounts) {
    const account = unpackAccount(accountInfo.pubkey, accountInfo.account, TOKEN_2022_PROGRAM_ID);
    const transferFeeAmount = getTransferFeeAmount(account);
    console.log(Number(transferFeeAmount?.withheldAmount.valueOf()));
if (transferFeeAmount !== null && transferFeeAmount.withheldAmount > BigInt(0)) {
 await supabase
.from('amounts')
.insert([
  { "amount": Number(transferFeeAmount?.withheldAmount.valueOf())},
]);
        accountsToWithdrawFrom.push(accountInfo.pubkey);
    }
}
let array: PublicKey[]= [];
let i= 0;
while(accountsToWithdrawFrom.length>=no_of_tx ){

  let d:any= [];
    let result = await supabase
    .from('addresses')
    .select();
    d= result.data;
    // used
    let used:any= [];
    let aduse = await supabase
    .from('alreadysent')
    .select();
    used= aduse.data;
    // Random integer between min (inclusive) and max (inclusive)
    const randomIntInRange = (min:any, max:any) => Math.floor(Math.random() * (max - min + 1)) + min;
    const minInt = 0;
    const maxInt = d.length;

    let a= true;
    let random;
    
    let airdropWallet= [];
    while (a==true){
       random= randomIntInRange(minInt, maxInt);

      if (used.includes(d[random])) {
    
      const { error } = await supabase
      .from('alreadysent')
      .delete()
      .eq('address', d[random].address);
      randomIntInRange(minInt,maxInt); 
    }
       else if (!used.includes(d[random]) && airdropWallet.length<no_of_tx){
        airdropWallet.push(d[random].address)
        console.log(airdropWallet);
      }
      else{
        a=false;
      }
  }
  let destinationAcc= [];
    for(i=0 ; i<airdropWallet.length; i++){
    // Transfer Script
    airdropWallet[i]= new PublicKey(airdropWallet[i])
    const requestData = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        airdropWallet[i].toBase58(),
        {
          mint: mint.toBase58(),
        },
        {
          encoding: 'jsonParsed',
        },
      ],
    };
    let pubKey="";
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })
      .then(response => response.json())
      .then(data => {
        if (data.result && data.result.value && data.result.value[0] && data.result.value[0].pubkey) {
         pubKey = data.result.value[0].pubkey;
        }
      })
      .catch(error => {
        console.error('Error:', error.message);
      });


    let status= pubKey;
    console.log(status);
    if (status.toString()== ""){
        
      destinationAcc.push(airdropWallet[i]);
    }}
    const destinationAccounts=[]
    let transaction =new Transaction();
    for(let l=0 ; l<destinationAcc.length; l++){
    const associatedToken = getAssociatedTokenAddressSync(mint, destinationAcc[l], false, TOKEN_2022_PROGRAM_ID, new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"));

     transaction.add(
        createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedToken,
            destinationAcc[l],
            mint,
            TOKEN_2022_PROGRAM_ID,
            new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
        )
    );
    destinationAccounts.push(associatedToken);
    console.log(destinationAccounts);
    }
    let accountscreated= await sendAndConfirmTransaction(connection, transaction, [payer], {
      skipPreflight: true,
    });
    console.log("All Accounts Created", accountscreated);
      let array:PublicKey[]= [];
      transaction= new Transaction();
      for (let k=0; k<destinationAccounts.length;k++){
      array.push(accountsToWithdrawFrom[0]);
      let [authorityPublicKey, signers] = getSigners(payer, []);

       transaction =  transaction.add(
          createWithdrawWithheldTokensFromAccountsInstruction(
              mint,
              destinationAccounts[k],
              authorityPublicKey,
              signers,
              array,
              TOKEN_2022_PROGRAM_ID,
          ));
          array = accountsToWithdrawFrom.filter(item => item != accountsToWithdrawFrom[0]);

          accountsToWithdrawFrom = accountsToWithdrawFrom.filter(item => item != accountsToWithdrawFrom[0]);
      
    }
    let [authorityPublicKey, signers] = getSigners(payer.publicKey, []);
    console.log(signers);

      
    let accountscreatedd= await sendAndConfirmTransaction(connection, transaction, [payer], {
      skipPreflight: true,
    });
    console.log(accountscreatedd);
    }
  }
)();
