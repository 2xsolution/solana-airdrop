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

(async () => {
    const payer= loadWalletKey("C://id.json");
    const mintAuthority = Keypair.generate();
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;
    console.log("Token Address : ", mint.toBase58());
    const transferFeeConfigAuthority = payer.publicKey;
    const withdrawWithheldAuthority = payer.publicKey;

    const extensions = [ExtensionType.TransferFeeConfig];

    const mintLen = getMintLen(extensions);
    const decimals = 9;
    const feeBasisPoints = 50;
    const maxFee = BigInt(5_000);

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
    await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);

    const mintAmount = BigInt(1_000_000_000);
    const owner = Keypair.generate();
    const sourceAccount = await createAccount(
        connection,
        payer,
        mint,
        owner.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    );
    await mintTo(
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

    const transferToAccounts = async () => {
        const destinationAccounts = [];
        const numAccounts = 10;

        // Generate destination accounts and add them to the array
        for (let i = 0; i < numAccounts; i++) {
            const accountKeypair = Keypair.generate();
            destinationAccounts.push(accountKeypair);

            // Create accounts for destination addresses
            await createAccount(
                connection,
                payer,
                mint,
                accountKeypair.publicKey,
                accountKeypair,
                undefined,
                TOKEN_2022_PROGRAM_ID
            );

            console.log(`Created account for ${accountKeypair.publicKey.toBase58()}`);
        }

        // Transfer tokens to each destination account
        for (const destinationAccount of destinationAccounts) {
            const transferAmount = BigInt(100_000); // Adjust the transfer amount as needed
            const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);

            await transferCheckedWithFee(
                connection,
                payer,
                sourceAccount,
                mint,
                destinationAccount.publicKey,
                owner,
                transferAmount,
                decimals,
                fee,
                [],
                undefined,
                TOKEN_2022_PROGRAM_ID
            );

            console.log(`Transferred ${transferAmount} tokens to account: ${destinationAccount.publicKey.toBase58()}`);
        }
    };

    // Execute the transferToAccounts function
    await transferToAccounts();

})();
