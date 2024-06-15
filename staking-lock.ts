import {
    Blockfrost,
    C,
    Data,
    Lucid,
    SpendingValidator,
    TxHash,
    fromHex,
    toHex,
  } from "https://deno.land/x/lucid@0.8.3/mod.ts";
  import * as cbor from "https://deno.land/x/cbor@v1.4.1/index.js";
   
  const lucid = await Lucid.new(
    new Blockfrost(
      "https://cardano-preview.blockfrost.io/api/v0",
      Deno.env.get("BLOCKFROST_API_KEY"),
    ),
    "Preview",
  );
   
  lucid.selectWalletFromPrivateKey(await Deno.readTextFile("./owner.sk"));
   
  const validator = await readValidator();
   
  // --- Supporting func
   
  async function readValidator(): Promise<SpendingValidator> {
    const validator = JSON.parse(await Deno.readTextFile("plutus.json")).validators[0];
    return {
      type: "PlutusV2",
      script: toHex(cbor.encode(fromHex(validator.compiledCode))),
    };
  }

  const ownerPublicKeyHash = lucid.utils.getAddressDetails(
    await lucid.wallet.address()
  ).paymentCredential.hash;
   
  const beneficiaryPublicKeyHash =
    lucid.utils.getAddressDetails(await Deno.readTextFile("beneficiary.addr"))
      .paymentCredential.hash;
   
  const Datum = Data.Object({
    lock_until: Data.BigInt, // timestamp
    owner: Data.String, // byte array or string
    beneficiary: Data.String, // byte array or string
    beneficiary2: Data.String, // byte array or string
    beneficiary3: Data.String, // byte array or string
  });
   
  type Datum = Data.Static<typeof Datum>;
   
  const datum = Data.to<Datum>(
    {
      lock_until: 1718391735000n, 
      owner: ownerPublicKeyHash, // own wallet verification key hash
      beneficiary: beneficiaryPublicKeyHash,
      beneficiary2: beneficiaryPublicKeyHash,
      beneficiary3: beneficiaryPublicKeyHash,
    },
    Datum
  );
   
  const txLock = await lock(1000000, { into: validator, datum: datum });
   
  await lucid.awaitTx(txLock);
   
  console.log(`1 tADA locked into the contract
      Tx ID: ${txLock}
      Datum: ${datum}
  `);
   
  // --- Supporting func
   
  async function lock(lovelace, { into, datum }): Promise<TxHash> {
    const contractAddress = lucid.utils.validatorToAddress(into);
   
    const tx = await lucid
      .newTx()
      .payToContract(contractAddress, { inline: datum }, { lovelace })
      .complete();
   
    const signedTx = await tx.sign().complete();
   
    return signedTx.submit();
  }



// export BLOCKFROST_API_KEY=previewfeElnTv5UiYXBFMzCrKjamFdOLDG5uE3
// deno run --allow-net --allow-read --allow-env staking-lock.ts

// 1 tADA locked into the contract
//       Tx ID: 58f8c6dbf7369fb7c6b3dd5ad72266ddca3677ae03d9bff0578d189f6bf24211
//       Datum: d8799f1b00000190182102d8581c4509f11d2839bf669950906b8670c4bdaf7dbd965d4ded1d6c73994a581c0be80effa60c673d9357db891349306c8d4367d08cd293b0bc2af8a8ff