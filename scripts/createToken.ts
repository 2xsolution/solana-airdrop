import {
    clusterApiUrl,
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {
    ExtensionType,
    createInitializeMintInstruction,
    mintTo,
    createAccount,
    getMintLen,
    getTransferFeeAmount,
    unpackAccount,
    TOKEN_2022_PROGRAM_ID,
} from '../src';

import {
    createInitializeTransferFeeConfigInstruction,
    harvestWithheldTokensToMint,
    transferCheckedWithFee,
    withdrawWithheldTokensFromAccounts,
    withdrawWithheldTokensFromMint,
} from '../src/extensions/transferFee/index';
import * as fs from 'fs';


export function loadWalletKey(keypairFile:string): Keypair {
    if (!keypairFile || keypairFile == '') {
      throw new Error('Keypair is required!');
    }
    const loaded = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypairFile).toString())),
    );
    return loaded;
  }
  const payer= loadWalletKey("C://id.json");
  const decimals = 9; //decimals
  const feeBasisPoints = 50; //fee_points
  const maxFee = BigInt(5_000); // max fee you want to collect from a single transfer
  const mintAmount = BigInt(1_000_000_000); //Supply You Want To Mint
  const mintAuthority = Keypair.generate(); 
  const mintKeypair = Keypair.generate();

  const mint = mintKeypair.publicKey;
  const transferFeeConfigAuthority = payer.publicKey;
  const withdrawWithheldAuthority = payer.publicKey;


(async () => {
 
    const extensions = [ExtensionType.TransferFeeConfig];

    const mintLen = getMintLen(extensions);

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');


    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeTransferFeeConfigInstruction(
            mint,
            transferFeeConfigAuthority,
            withdrawWithheldAuthority,
            feeBasisPoints,
            maxFee,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID)
    );
    let txmint= await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
    console.log("Token Address/Mint Address : ", mint.toBase58());
    console.log("TokenCreation Tx : ", txmint);

    const owner = Keypair.generate();
    const sourceAccount = await createAccount(
        connection,
        payer,
        mint,
        payer.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    );
    let tx= await mintTo(
        connection,
        payer,
        mint,
        sourceAccount,
        mintAuthority,
        mintAmount,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    );

    console.log("Supply Mint Tx: " , tx);



})();
