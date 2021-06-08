YumDaiVaultimport chai from "chai";
import chaiSubset from "chai-subset";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { ContractFactory, Signer, utils } from "ethers";
import { MigratableTransmuter } from "../../types/MigratableTransmuter";
import { YumDaiVault } from "../../types/YumDaiVault";
import { WaToken } from "../../types/WaToken";
import { Erc20Mock } from "../../types/Erc20Mock";
import { ZERO_ADDRESS } from "../utils/helpers";
import { LiquityVaultAdapterMock } from "../../types/LiquityVaultAdapterMock";
const {parseEther, formatEther} = utils;

chai.use(solidity);
chai.use(chaiSubset);

const { expect } = chai;

let YumDaiVaultFactory: ContractFactory;
let AlUSDFactory: ContractFactory;
let ERC20MockFactory: ContractFactory;
let LiquityVaultAdapterMockFactory: ContractFactory;
let MigratableTransmuterFactory: ContractFactory;

describe("YumDaiVault", () => {
  let signers: Signer[];

  before(async () => {
    YumDaiVaultFactory = await ethers.getContractFactory("YumDaiVault");
    MigratableTransmuterFactory = await ethers.getContractFactory("MigratableTransmuter");
    AlUSDFactory = await ethers.getContractFactory("WaToken");
    ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    LiquityVaultAdapterMockFactory = await ethers.getContractFactory(
      "LiquityVaultAdapterMock"
    );
  });

  beforeEach(async () => {
    signers = await ethers.getSigners();
  });

  describe("constructor", async () => {
    let deployer: Signer;
    let governance: Signer;
    let sentinel: Signer;
    let token: Erc20Mock;
    let alUsd: WaToken;
    let alchemist: YumDaiVault;

    beforeEach(async () => {
      [deployer, governance, sentinel, ...signers] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaToken;
    });

    context("when governance is the zero address", () => {
      it("reverts", async () => {
        expect(
          YumDaiVaultFactory.connect(deployer).deploy(
            token.address,
            alUsd.address,
            ZERO_ADDRESS,
            await sentinel.getAddress()
          )
        ).revertedWith("YumDaiVault: governance address cannot be 0x0.");
      });
    });
  });

  describe("update Alchemist addys and variables", () => {
    let deployer: Signer;
    let governance: Signer;
    let newGovernance: Signer;
    let rewards: Signer;
    let sentinel: Signer;
    let transmuter: Signer;
    let token: Erc20Mock;
    let alUsd: WaToken;
    let alchemist: YumDaiVault;


    beforeEach(async () => {
      [
        deployer,
        governance,
        newGovernance,
        rewards,
        sentinel,
        transmuter,
        ...signers
      ] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaToken;

      alchemist = (await YumDaiVaultFactory.connect(deployer).deploy(
        token.address,
        alUsd.address,
        await governance.getAddress(),
        await sentinel.getAddress()
      )) as YumDaiVault;

    });

    describe("set governance", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(
            alchemist.setPendingGovernance(await newGovernance.getAddress())
          ).revertedWith("YumDaiVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting governance to zero address", async () => {
          expect(alchemist.setPendingGovernance(ZERO_ADDRESS)).revertedWith(
            "YumDaiVault: governance address cannot be 0x0."
          );
        });

        it("updates rewards", async () => {
          await alchemist.setRewards(await rewards.getAddress());
          expect(await alchemist.rewards()).equal(await rewards.getAddress());
        });
      });
    });

    describe("set transmuter", () => {
      context("when caller is not current governance", () => {
        it("reverts", async () => {
          expect(
            alchemist.setTransmuter(await transmuter.getAddress())
          ).revertedWith("YumDaiVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting transmuter to zero address", async () => {
          expect(alchemist.setTransmuter(ZERO_ADDRESS)).revertedWith(
            "YumDaiVault: transmuter address cannot be 0x0."
          );
        });

        it("updates transmuter", async () => {
          await alchemist.setTransmuter(await transmuter.getAddress());
          expect(await alchemist.transmuter()).equal(
            await transmuter.getAddress()
          );
        });
      });
    });

    describe("set rewards", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.setRewards(await rewards.getAddress())).revertedWith(
            "YumDaiVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when setting rewards to zero address", async () => {
          expect(alchemist.setRewards(ZERO_ADDRESS)).revertedWith(
            "YumDaiVault: rewards address cannot be 0x0."
          );
        });

        it("updates rewards", async () => {
          await alchemist.setRewards(await rewards.getAddress());
          expect(await alchemist.rewards()).equal(await rewards.getAddress());
        });
      });
    });

    describe("set peformance fee", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.setHarvestFee(1)).revertedWith(
            "YumDaiVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when performance fee greater than maximum", async () => {
          const MAXIMUM_VALUE = await alchemist.PERCENT_RESOLUTION();
          expect(alchemist.setHarvestFee(MAXIMUM_VALUE.add(1))).revertedWith(
            "YumDaiVault: harvest fee above maximum"
          );
        });

        it("updates performance fee", async () => {
          await alchemist.setHarvestFee(1);
          expect(await alchemist.harvestFee()).equal(1);
        });
      });
    });

    describe("set collateralization limit", () => {
      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(collateralizationLimit)
          ).revertedWith("YumDaiVault: only governance");
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        it("reverts when performance fee less than minimum", async () => {
          const MINIMUM_LIMIT = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(MINIMUM_LIMIT.sub(1))
          ).revertedWith("YumDaiVault: collateralization limit below minimum.");
        });

        it("reverts when performance fee greater than maximum", async () => {
          const MAXIMUM_LIMIT = await alchemist.MAXIMUM_COLLATERALIZATION_LIMIT();
          expect(
            alchemist.setCollateralizationLimit(MAXIMUM_LIMIT.add(1))
          ).revertedWith("YumDaiVault: collateralization limit above maximum");
        });

        it("updates collateralization limit", async () => {
          const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
          await alchemist.setCollateralizationLimit(collateralizationLimit);
          expect(await alchemist.collateralizationLimit()).containSubset([
            collateralizationLimit,
          ]);
        });
      });
    });
  });

  describe("vault actions", () => {
    let deployer: Signer;
    let governance: Signer;
    let sentinel: Signer;
    let rewards: Signer;
    let transmuter: Signer;
    let minter: Signer;
    let user: Signer;
    let token: Erc20Mock;
    let alUsd: WaToken;
    let alchemist: YumDaiVault;
    let adapter: LiquityVaultAdapterMock;
    let harvestFee = 1000;
    let pctReso = 10000;
    let transmuterContract: MigratableTransmuter;

    beforeEach(async () => {
      [
        deployer,
        governance,
        sentinel,
        rewards,
        transmuter,
        minter,
        user,
        ...signers
      ] = signers;

      token = (await ERC20MockFactory.connect(deployer).deploy(
        "Mock DAI",
        "DAI",
        18
      )) as Erc20Mock;

      alUsd = (await AlUSDFactory.connect(deployer).deploy()) as WaToken;

      alchemist = (await YumDaiVaultFactory.connect(deployer).deploy(
        token.address,
        alUsd.address,
        await governance.getAddress(),
        await sentinel.getAddress()
      )) as YumDaiVault;

      await alchemist
        .connect(governance)
        .setTransmuter(await transmuter.getAddress());
      await alchemist
        .connect(governance)
        .setRewards(await rewards.getAddress());
      await alchemist.connect(governance).setHarvestFee(harvestFee);
      transmuterContract = (await MigratableTransmuterFactory.connect(deployer).deploy(
        alUsd.address,
        token.address,
        await governance.getAddress()
      )) as MigratableTransmuter;
      await alchemist.connect(governance).setTransmuter(transmuterContract.address);
      await transmuterContract.connect(governance).setWhitelist(alchemist.address, true);
      await token.mint(await minter.getAddress(), parseEther("10000"));
      await token.connect(minter).approve(alchemist.address, parseEther("10000"));
    });

    describe("migrate", () => {
      beforeEach(async () => {
        adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
          token.address
        )) as LiquityVaultAdapterMock;

        await alchemist.connect(governance).initialize(adapter.address);
      });

      context("when caller is not current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(deployer)));

        it("reverts", async () => {
          expect(alchemist.migrate(adapter.address)).revertedWith(
            "YumDaiVault: only governance"
          );
        });
      });

      context("when caller is current governance", () => {
        beforeEach(() => (alchemist = alchemist.connect(governance)));

        context("when adapter is zero address", async () => {
          it("reverts", async () => {
            expect(alchemist.migrate(ZERO_ADDRESS)).revertedWith(
              "YumDaiVault: active vault address cannot be 0x0."
            );
          });
        });

        context("when adapter token mismatches", () => {
          const tokenAddress = ethers.utils.getAddress(
            "0xffffffffffffffffffffffffffffffffffffffff"
          );

          let invalidAdapter: LiquityVaultAdapterMock;

          beforeEach(async () => {
            invalidAdapter = (await LiquityVaultAdapterMockFactory.connect(
              deployer
            ).deploy(tokenAddress)) as LiquityVaultAdapterMock;
          });

          it("reverts", async () => {
            expect(alchemist.migrate(invalidAdapter.address)).revertedWith(
              "YumDaiVault: token mismatch"
            );
          });
        });

        context("when conditions are met", () => {
          beforeEach(async () => {
            await alchemist.migrate(adapter.address);
          });

          it("increments the vault count", async () => {
            expect(await alchemist.vaultCount()).equal(2);
          });

          it("sets the vaults adapter", async () => {
            expect(await alchemist.getVaultAdapter(0)).equal(adapter.address);
          });
        });
      });
    });

    describe("flush funds", () => {
      let adapter: LiquityVaultAdapterMock;

      context("when the Alchemist is not initialized", () => {
        it("reverts", async () => {
          expect(alchemist.flush()).revertedWith("YumDaiVault: not initialized.");
        });
      });

      context("when there is at least one vault to flush to", () => {
        context("when there is one vault", () => {
          let adapter: LiquityVaultAdapterMock;
          let mintAmount = parseEther("5000");

          beforeEach(async () => {
            adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
              token.address
            )) as LiquityVaultAdapterMock;
          });

          beforeEach(async () => {
            await token.mint(alchemist.address, mintAmount);

            await alchemist.connect(governance).initialize(adapter.address);

            await alchemist.flush();
          });

          it("flushes funds to the vault", async () => {
            expect(await token.balanceOf(adapter.address)).equal(mintAmount);
          });
        });

        context("when there are multiple vaults", () => {
          let inactiveAdapter: LiquityVaultAdapterMock;
          let activeAdapter: LiquityVaultAdapterMock;
          let mintAmount = parseEther("5000");

          beforeEach(async () => {
            inactiveAdapter = (await LiquityVaultAdapterMockFactory.connect(
              deployer
            ).deploy(token.address)) as LiquityVaultAdapterMock;

            activeAdapter = (await LiquityVaultAdapterMockFactory.connect(
              deployer
            ).deploy(token.address)) as LiquityVaultAdapterMock;

            await token.mint(alchemist.address, mintAmount);

            await alchemist
              .connect(governance)
              .initialize(inactiveAdapter.address);

            await alchemist.connect(governance).migrate(activeAdapter.address);

            await alchemist.flush();
          });

          it("flushes funds to the active vault", async () => {
            expect(await token.balanceOf(activeAdapter.address)).equal(
              mintAmount
            );
          });
        });
      });
    });

    describe("deposit and withdraw tokens", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("10000");
      let collateralizationLimit = "2000000000000000000"; // this should be set in the deploy sequence
      beforeEach(async () => {
        adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
          token.address
        )) as LiquityVaultAdapterMock;
        await alchemist.connect(governance).initialize(adapter.address);
        await alchemist
          .connect(governance)
          .setCollateralizationLimit(collateralizationLimit);
        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), depositAmt);
        await token.connect(minter).approve(alchemist.address, parseEther("100000000"));
        await alUsd.connect(minter).approve(alchemist.address, parseEther("100000000"));
      });

      it("deposited amount is accounted for correctly", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        expect(
          await alchemist
            .connect(minter)
            .getCdpTotalDeposited(await minter.getAddress())
        ).equal(depositAmt);
      });

      it("deposits token and then withdraws all", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).withdraw(depositAmt);
        let balAfter = await token.balanceOf(await minter.getAddress());
        expect(balBefore).equal(balAfter);
      });

      it("reverts when withdrawing too much", async () => {
        let overdraft = depositAmt.add(parseEther("1000"));
        await alchemist.connect(minter).deposit(depositAmt);
        expect(alchemist.connect(minter).withdraw(overdraft)).revertedWith("ERC20: transfer amount exceeds balance");
      });

      it("reverts when cdp is undercollateralized", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        expect(alchemist.connect(minter).withdraw(depositAmt)).revertedWith("Action blocked: unhealthy collateralization ratio");
      });

      it("deposits, mints, repays, and withdraws", async () => {
        let balBefore = await token.balanceOf(await minter.getAddress());
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await alchemist.connect(minter).repay(0, mintAmt);
        await alchemist.connect(minter).withdraw(depositAmt);
        let balAfter = await token.balanceOf(await minter.getAddress());
        expect(balBefore).equal(balAfter);
      });

      it("deposits 5000 DAI, mints 1000 alUSD, and withdraws 3000 DAI", async () => {
        let withdrawAmt = depositAmt.sub(mintAmt.mul(2));
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await alchemist.connect(minter).withdraw(withdrawAmt);
        expect(await token.balanceOf(await minter.getAddress())).equal(
          parseEther("13000")
        );
      });

      describe("flushActivator", async () => {
        beforeEach(async () => {
          await token.connect(deployer).approve(alchemist.address, parseEther("1"));
          await token.mint(await deployer.getAddress(), parseEther("1"));
          await token.mint(await minter.getAddress(), parseEther("100000"));
          await alchemist.connect(deployer).deposit(parseEther("1"));
        });

        it("deposit() flushes funds if amount >= flushActivator", async () => {
          let balBeforeWhale = await token.balanceOf(adapter.address);
          await alchemist.connect(minter).deposit(parseEther("100000"));
          let balAfterWhale = await token.balanceOf(adapter.address);
          expect(balBeforeWhale).equal(0);
          expect(balAfterWhale).equal(parseEther("100001"));
        });

        it("deposit() does not flush funds if amount < flushActivator", async () => {
          let balBeforeWhale = await token.balanceOf(adapter.address);
          await alchemist.connect(minter).deposit(parseEther("99999"));
          let balAfterWhale = await token.balanceOf(adapter.address);
          expect(balBeforeWhale).equal(0);
          expect(balAfterWhale).equal(0);
        });
      })
    });

    describe("repay and liquidate tokens", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("10000");
      let collateralizationLimit = "2000000000000000000"; // this should be set in the deploy sequence
      beforeEach(async () => {
        adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
          token.address
        )) as LiquityVaultAdapterMock;
        await alchemist.connect(governance).initialize(adapter.address);
        await alchemist
          .connect(governance)
          .setCollateralizationLimit(collateralizationLimit);
        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), ceilingAmt);
        await token.connect(minter).approve(alchemist.address, ceilingAmt);
        await alUsd.connect(minter).approve(alchemist.address, parseEther("100000000"));
        await token.connect(minter).approve(transmuterContract.address, ceilingAmt);
        await alUsd.connect(minter).approve(transmuterContract.address, depositAmt);
      });
      it("repay with dai reverts when nothing is minted and transmuter has no alUsd deposits", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")))
        expect(alchemist.connect(minter).repay(mintAmt, 0)).revertedWith("SafeMath: subtraction overflow")
      })
      it("liquidate max amount possible if trying to liquidate too much", async () => {
        let liqAmt = depositAmt;
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await transmuterContract.connect(minter).stake(mintAmt);
        await alchemist.connect(minter).liquidate(liqAmt);
        const transBal = await token.balanceOf(transmuterContract.address);
        expect(transBal).equal(mintAmt);
      })
      it("liquidates funds from vault if not enough in the buffer", async () => {
        let liqAmt = parseEther("600");
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(governance).flush();
        await alchemist.connect(minter).deposit(mintAmt.div(2));
        await alchemist.connect(minter).mint(mintAmt);
        await transmuterContract.connect(minter).stake(mintAmt);
        const alchemistTokenBalPre = await token.balanceOf(alchemist.address);
        await alchemist.connect(minter).liquidate(liqAmt);
        const alchemistTokenBalPost = await token.balanceOf(alchemist.address);
        console.log("pre", alchemistTokenBalPre.toString(), alchemistTokenBalPost.toString())
        const transmuterEndingTokenBal = await token.balanceOf(transmuterContract.address);
        expect(alchemistTokenBalPost).equal(0);
        expect(transmuterEndingTokenBal).equal(liqAmt);
      })
      it("liquidates the minimum necessary from the alchemist buffer", async () => {
        let dep2Amt = parseEther("500");
        let liqAmt = parseEther("200");
        await alchemist.connect(minter).deposit(parseEther("2000"));
        await alchemist.connect(governance).flush();
        await alchemist.connect(minter).deposit(dep2Amt);
        await alchemist.connect(minter).mint(parseEther("1000"));
        await transmuterContract.connect(minter).stake(parseEther("1000"));
        const alchemistTokenBalPre = await token.balanceOf(alchemist.address);
        await alchemist.connect(minter).liquidate(liqAmt);
        const alchemistTokenBalPost = await token.balanceOf(alchemist.address);

        const transmuterEndingTokenBal = await token.balanceOf(transmuterContract.address);
        expect(alchemistTokenBalPost).equal(dep2Amt.sub(liqAmt));
        expect(transmuterEndingTokenBal).equal(liqAmt);
      })
      it("deposits, mints alUsd, repays, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")));
        await alchemist.connect(minter).mint(mintAmt);
        await transmuterContract.connect(minter).stake(mintAmt);
        await alchemist.connect(minter).repay(mintAmt, 0);
        expect(await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())).equal(0)
      })
      it("deposits, mints, repays, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await alchemist.connect(minter).repay(0, mintAmt);
        expect(
          await alchemist
            .connect(minter)
            .getCdpTotalDebt(await minter.getAddress())
        ).equal(0);
      });
      it("deposits, mints alUsd, repays with alUsd and DAI, and has no outstanding debt", async () => {
        await alchemist.connect(minter).deposit(depositAmt.sub(parseEther("1000")));
        await alchemist.connect(minter).mint(mintAmt);
        await transmuterContract.connect(minter).stake(parseEther("500"));
        await alchemist.connect(minter).repay(parseEther("500"), parseEther("500"));
        expect(await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())).equal(0)
      })

      it("deposits and liquidates DAI", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        await alchemist.connect(minter).mint(mintAmt);
        await transmuterContract.connect(minter).stake(mintAmt);
        await alchemist.connect(minter).liquidate(mintAmt);
        expect( await alchemist.connect(minter).getCdpTotalDeposited(await minter.getAddress())).equal(depositAmt.sub(mintAmt))
      });
    });

    describe("mint", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let ceilingAmt = parseEther("1000");

      beforeEach(async () => {
        adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
          token.address
        )) as LiquityVaultAdapterMock;

        await alchemist.connect(governance).initialize(adapter.address);

        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await minter.getAddress(), depositAmt);
        await token.connect(minter).approve(alchemist.address, depositAmt);
      });

      it("reverts if the Alchemist is not whitelisted", async () => {
        await alchemist.connect(minter).deposit(depositAmt);
        expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
          "AlUSD: Alchemist is not whitelisted"
        );
      });

      context("is whiltelisted", () => {
        beforeEach(async () => {
          await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        });

        it("reverts if the Alchemist is blacklisted", async () => {

          await alUsd.connect(deployer).setBlacklist(alchemist.address);
          await alchemist.connect(minter).deposit(depositAmt);
          expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
            "AlUSD: Alchemist is blacklisted"
          );
        });

        it("reverts when trying to mint too much", async () => {
          expect(alchemist.connect(minter).mint(parseEther("2000"))).revertedWith(
            "Loan-to-value ratio breached"
          );
        });

        it("reverts if the ceiling was breached", async () => {
          let lowCeilingAmt = parseEther("100");
          await alUsd
            .connect(deployer)
            .setCeiling(alchemist.address, lowCeilingAmt);
          await alchemist.connect(minter).deposit(depositAmt);
          expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
            "AlUSD: Alchemist's ceiling was breached"
          );
        });

        it("mints successfully to depositor", async () => {
          let balBefore = await token.balanceOf(await minter.getAddress());
          await alchemist.connect(minter).deposit(depositAmt);
          await alchemist.connect(minter).mint(mintAmt);
          let balAfter = await token.balanceOf(await minter.getAddress());

          expect(balAfter).equal(balBefore.sub(depositAmt));
          expect(await alUsd.balanceOf(await minter.getAddress())).equal(mintAmt);
        });
      });
    });

    describe("harvest", () => {
      let depositAmt = parseEther("5000");
      let mintAmt = parseEther("1000");
      let stakeAmt = mintAmt.div(2);
      let ceilingAmt = parseEther("10000");
      let yieldAmt = parseEther("100");

      beforeEach(async () => {
        adapter = (await LiquityVaultAdapterMockFactory.connect(deployer).deploy(
          token.address
        )) as LiquityVaultAdapterMock;

        await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        await alchemist.connect(governance).initialize(adapter.address);
        await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        await token.mint(await user.getAddress(), depositAmt);
        await token.connect(user).approve(alchemist.address, depositAmt);
        await alUsd.connect(user).approve(transmuterContract.address, depositAmt);
        await alchemist.connect(user).deposit(depositAmt);
        await alchemist.connect(user).mint(mintAmt);
        await transmuterContract.connect(user).stake(stakeAmt);
        await alchemist.flush();
      });

      it("harvests yield from the vault", async () => {
        await token.mint(adapter.address, yieldAmt);
        await alchemist.harvest(0);
        let transmuterBal = await token.balanceOf(transmuterContract.address);
        expect(transmuterBal).equal(yieldAmt.sub(yieldAmt.div(pctReso/harvestFee)));
        let vaultBal = await token.balanceOf(adapter.address);
        expect(vaultBal).equal(depositAmt);
      })

      it("sends the harvest fee to the rewards address", async () => {
        await token.mint(adapter.address, yieldAmt);
        await alchemist.harvest(0);
        let rewardsBal = await token.balanceOf(await rewards.getAddress());
        expect(rewardsBal).equal(yieldAmt.mul(100).div(harvestFee));
      })

      it("does not update any balances if there is nothing to harvest", async () => {
        let initTransBal = await token.balanceOf(transmuterContract.address);
        let initRewardsBal = await token.balanceOf(await rewards.getAddress());
        await alchemist.harvest(0);
        let endTransBal = await token.balanceOf(transmuterContract.address);
        let endRewardsBal = await token.balanceOf(await rewards.getAddress());
        expect(initTransBal).equal(endTransBal);
        expect(initRewardsBal).equal(endRewardsBal);
      })
    })
  });
});
