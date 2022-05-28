const { assert } = require("chai");
const chai = require("chai");
const { ethers } = require("hardhat");
const { expect } = chai;

describe("JobContract", async function () {
  let jobContract,
    jobCountPrev,
    jobOwnerBalancePrev,
    escrowBalancePrev,
    freelancerBalancePrev,
    jobToken;

  before(async function () {
    const JobToken = await ethers.getContractFactory("JobToken");
    jobToken = await JobToken.deploy();

    await jobToken.deployed();

    const JobContract = await ethers.getContractFactory("JobContract");
    jobContract = await JobContract.deploy(jobToken.address);
    await jobContract.deployed();

    jobCountPrev = await jobContract.JobCount();
    [jobOwner, freelancer] = await hre.ethers.getSigners();
  });

  describe("Create New Job", function () {
    before(async function () {
      escrowBalancePrev = await jobToken.balanceOf(jobContract.address);
      jobOwnerBalancePrev = await jobToken.balanceOf(jobOwner.address);
    });
    it("Assigns initial balance", async () => {
      expect(await jobToken.balanceOf(jobOwner.address)).to.equal(1000);
    });
    it("Should properly allocate the money", async function () {
      await expect(
        jobToken.approve(jobContract.address, 10, {
          from: jobOwner.address,
        })
      )
        .to.emit(jobToken, "Approval")
        .withArgs(jobOwner.address, jobContract.address, 10);
    });
    it("Should caller be the owner", async function () {
      await expect(
        jobContract.createJob("Job1", 3, {
          from: jobOwner.address,
        })
      )
        .to.emit(jobContract, "JobCreated")
        .withArgs(1, jobOwner.address, 3);
    });

    it("Should increment jobCount", async function () {
      jobCountAfter = await jobContract.JobCount();
      assert.equal(jobCountAfter.toNumber(), 1, "jobcounter did not increment");
    });

    it("Should transfer", async function () {
      expect(await jobToken.balanceOf(jobContract.address)).to.equal(
        escrowBalancePrev.toNumber() + 3
      );
      expect(await jobToken.balanceOf(jobOwner.address)).to.equal(
        jobOwnerBalancePrev.toNumber() - 3
      );
    });
  });

  describe("Delete Job", function () {
    before(async function () {
      escrowBalancePrev = await jobToken.balanceOf(jobContract.address);
      jobOwnerBalancePrev = await jobToken.balanceOf(jobOwner.address);
    });

    it("Should not be able to be deleted by a non-owner", async function () {
      await expect(jobContract.deleteJob(1, { from: freelancer.address })).to.be
        .reverted;
    });
    it("Should emit event", async function () {
      await expect(
        jobContract.deleteJob(1, {
          from: jobOwner.address,
        })
      )
        .to.emit(jobContract, "JobDeleted")
        .withArgs(1, jobOwner.address);
    });
    //Should not allow a job to be deleted again if its already deleted
    it("Should change job status", async function () {
      await expect(
        jobContract.deleteJob(1, {
          from: jobOwner.address,
        })
      ).to.be.reverted;
    });
    it("Should transfer back", async function () {
      expect(await jobToken.balanceOf(jobContract.address)).to.equal(
        escrowBalancePrev.toNumber() - 3
      );
      expect(await jobToken.balanceOf(jobOwner.address)).to.equal(
        jobOwnerBalancePrev.toNumber() + 3
      );
    });
  });

  describe("Job assignment to freelancer", function () {
    before(async function () {
      await expect(
        jobContract.createJob("Job2", 3, {
          from: jobOwner.address,
        })
      )
        .to.emit(jobContract, "JobCreated")
        .withArgs(2, jobOwner.address, 3);
    });

    it("Should emit event of job assignment", async function () {
      await expect(jobContract.connect(freelancer).jobAssignment(2))
        .to.emit(jobContract, "JobAssigned")
        .withArgs(2, freelancer.address);
    });
    it("Should not be assignable when the jobStatus is anything but pending", async function () {
      await expect(jobContract.jobAssignment(2, { from: freelancer.address }))
        .to.be.reverted;
    });
  });

  describe("Mark Job Complete by freelancer", function () {
    before(async function () {
      await expect(
        jobContract.createJob("Job3", 3, {
          from: jobOwner.address,
        })
      )
        .to.emit(jobContract, "JobCreated")
        .withArgs(3, jobOwner.address, 3);
    });
    it("Should reject if not accepted by any freelancer", async function () {
      await expect(jobContract.markJobComplete(3, { from: freelancer.address }))
        .to.be.reverted;
    });
    it("Should emit event of job assignment", async function () {
      await expect(jobContract.connect(freelancer).jobAssignment(3))
        .to.emit(jobContract, "JobAssigned")
        .withArgs(3, freelancer.address);
    });
    it("Should emit event of marked complete", async function () {
      await expect(jobContract.connect(freelancer).markJobComplete(3))
        .to.emit(jobContract, "MarkJobComplete")
        .withArgs(3, freelancer.address);
    });
  });

  describe("Mark job accepted by Owner", function () {
    before(async function () {
      escrowBalancePrev = await jobToken.balanceOf(jobContract.address);
      freelancerBalancePrev = await jobToken.balanceOf(freelancer.address);
    });
    it("Should reject if not called by owner", async function () {
      await expect(jobContract.acceptJob(3, { from: freelancer.address })).to.be
        .reverted;
    });
    it("Should reject if status is not approval pending", async function () {
      await expect(jobContract.acceptJob(2, { from: jobOwner.address })).to.be
        .reverted;
    });
    it("Should reject if status is not approval pending", async function () {
      await expect(jobContract.acceptJob(3))
        .to.emit(jobContract, "AcceptJob")
        .withArgs(3, freelancer.address);
    });
    it("Should transfer", async function () {
      expect(await jobToken.balanceOf(jobContract.address)).to.equal(
        escrowBalancePrev.toNumber() - 3
      );
      expect(await jobToken.balanceOf(freelancer.address)).to.equal(
        freelancerBalancePrev.toNumber() + 3
      );
    });
  });
});
