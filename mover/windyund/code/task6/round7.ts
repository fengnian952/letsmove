


import {NAVISDKClient} from "navi-sdk";
import {TransactionBlock} from "@mysten/sui.js/transactions";
import {pool, Sui} from "navi-sdk/dist/address";
import {Pool, PoolConfig} from "navi-sdk/dist/types";
import {SignAndSubmitTXB} from "navi-sdk/dist/libs/PTB";


// 🔹 Borrow at least 10 SUI from NAVI (it is advised to have at least 20 SUI liquidity on NAVI before proceeding)
// 🔹 Stake the SUI from Step 1 to Volo Sui Contract and Aftermath Sui Contract to get at least 5 vSUI and 5 afSUI separately.
async function task1() {

    const mnemonic = "your address";
    const client = new NAVISDKClient({
        mnemonic: mnemonic,
        networkType: "mainnet",
        numberOfAccounts: 1,
    });
    let txb = new TransactionBlock();
    const account = client.accounts[0];
    let sender = account.address;
    console.log("address: ", sender)
    txb.setSender(sender);


    const Sui_Pool: PoolConfig = pool[Sui.symbol as keyof Pool];
    const amount_to_borrow = BigInt(10) * BigInt(10) ** BigInt(9);

    //step 1
    let borrow_result = await txb.moveCall({
        target:
            "0xc6374c7da60746002bfee93014aeb607e023b2d6b25c9e55a152b826dbc8c1ce::incentive_v2::borrow",
        arguments: [
            txb.object("0x06"), // clock object id
            txb.object("0x1568865ed9a0b5ec414220e8f79b3d04c77acc82358f6e5ae4635687392ffbef"), // The object id of the price oracle
            txb.object("0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe"), // Object id of storage
            txb.object(Sui_Pool.poolId), // pool id of the asset
            txb.pure(Sui_Pool.assetId), // The id of the asset in the protocol
            txb.pure(amount_to_borrow), // The amount you want to borrow
            txb.object("0xf87a8acb8b81d14307894d12595541a73f19933f88e1326d5be349c7a6f7559c"), // The incentive object v2
        ],
        typeArguments: [Sui_Pool.type], // type arguments, for this just the coin type
    });


    const borrow_coin =  txb.moveCall({
        target: '0x2::coin::from_balance',
        arguments: [borrow_result],
        typeArguments: [Sui_Pool.type]
    });

    console.log("borrow_coin: ",borrow_coin)

    const half_amount = (amount_to_borrow/BigInt(2));

    console.log("half_amount:",half_amount)
    //step 2
    const splitCoin =  txb.splitCoins(borrow_coin, [txb.pure(half_amount)]);

    console.log("splitCoin: ",splitCoin)

    // step 3 stake vsui
    await txb.moveCall({
        target: '0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::native_pool::stake',
        arguments: [
            txb.object('0x7fa2faa111b8c65bea48a23049bfd81ca8f971a262d981dcd9a17c3825cb5baf'),
            txb.object('0x680cd26af32b2bde8d3361e804c53ec1d1cfe24c7f039eb7f549e8dfde389a60'),
            txb.object("0x05"),
            splitCoin
        ]
        // typeArguments: []
    });
    console.log("stake vsui: ")

    //step 4  stake afsui
    let afsui = await txb.moveCall({
        target: `0x7f6ce7ade63857c4fd16ef7783fed2dfc4d7fb7e40615abdb653030b76aef0c6::staked_sui_vault::request_stake`,
        arguments: [
            txb.object('0x2f8f6d5da7f13ea37daa397724280483ed062769813b6f31e9788e59cc88994d'),
            txb.object('0xeb685899830dd5837b47007809c76d91a098d52aabbf61e8ac467c59e5cc4610'),
            txb.object("0x05"),
            txb.object("0x4ce9a19b594599536c53edb25d22532f82f18038dc8ef618afd00fbbfb9845ef"),
            borrow_coin,
            txb.pure("0xd30018ec3f5ff1a3c75656abf927a87d7f0529e6dc89c7ddd1bd27ecb05e3db2"),
        ],
        // typeArguments: []
    });
    console.log("stake afsui: ")

    txb.transferObjects([afsui], sender);

    const result = await SignAndSubmitTXB(txb, account.client, account.keypair);
    console.log("result: ", result);
}

task1()