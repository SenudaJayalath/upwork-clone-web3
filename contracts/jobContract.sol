//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./JobToken.sol";

contract JobContract {
    using SafeMath for uint256;
    JobToken public jobToken;

    constructor(address _tokenAddress) {
        jobToken = JobToken(_tokenAddress);
    }

    address payable EscrowAddress = payable(address(this));
    uint256 public JobCount = 0;
    enum JobStatus {
        PENDING,
        IN_PROGRESS,
        APPROVAL_PENDING,
        FINISHED,
        DELETED
    }
    struct Job {
        uint256 jobID;
        string jobTitle;
        address jobOwner;
        uint256 price;
        JobStatus jobStatus;
        address freelancer;
    }

    // Mapping to store active jobs. jobID to Job mapping.
    mapping(uint256 => Job) public JobList;

    event JobCreated(
        uint256 indexed _jobID,
        address indexed _jobOwner,
        uint256 _price
    );
    event JobDeleted(uint256 indexed _jobID, address indexed _jobOwner);
    event JobAssigned(uint256 indexed _jobID, address indexed _freelancer);
    event MarkJobComplete(uint256 indexed _jobID, address indexed _freelancer);
    event AcceptJob(uint256 indexed _jobID, address indexed _freelancer);
    event Test(JobStatus indexed _price);

    receive() external payable {}

    //Check if the person calling the function is the jobOwner
    modifier jobOwner(uint256 _jobID) {
        Job memory job = JobList[_jobID];
        require(msg.sender == job.jobOwner);
        _;
    }
    //Check if the person calling the function is the jobOwner
    modifier notJobOwner(uint256 _jobID) {
        Job memory job = JobList[_jobID];
        require(msg.sender != job.jobOwner);
        _;
    }
    //Check to see if this is a valid jobID
    modifier idExist(uint256 _jobID) {
        require(_jobID > 0 && _jobID <= JobCount);
        _;
    }

    // Function to create a job
    function createJob(string memory _jobTitle, uint256 _price)
        external
        payable
        returns (uint256)
    {
        // Check to see sent value is equal to the price
        uint256 allowance = jobToken.allowance(msg.sender, address(this));
        require(allowance > _price, "Check the token allowance");
        //Transfer the funds to escrow
        jobToken.transferFrom(msg.sender, EscrowAddress, _price);
        // Create struct with job details
        Job memory job = Job(
            JobCount,
            _jobTitle,
            msg.sender,
            _price,
            JobStatus.PENDING,
            address(0)
        );
        // Increment Job Number
        JobCount = JobCount.add(1);
        // Add the current job to JobList
        JobList[JobCount] = job;
        // Emmit event
        emit JobCreated(JobCount, msg.sender, _price);
        // Return ID
        return JobCount;
    }

    // Function to delete a job without been successful
    function deleteJob(uint256 _jobID)
        external
        idExist(_jobID)
        jobOwner(_jobID)
    {
        // Require the job to be pending
        Job storage job = JobList[_jobID];

        require(
            job.jobStatus == JobStatus.PENDING,
            "This job is already accepted by a freelancer"
        );

        //Get allocated price for the job
        uint256 _price = job.price;

        //Delete the job
        job.jobStatus = JobStatus.DELETED;
        // Transfer the funds back to the owner
        jobToken.transfer(payable(msg.sender), _price);
        // Emit event
        emit JobDeleted(_jobID, job.jobOwner);
    }

    // Function to get job assigned to freelancer
    function jobAssignment(uint256 _jobID) external idExist(_jobID) {
        //Require the job to be pending
        Job storage job = JobList[_jobID];
        require(
            job.jobStatus == JobStatus.PENDING,
            "This job is already accepted by a freelancer"
        );
        // Assign freelancer to job
        job.freelancer = msg.sender;
        // Change status of job
        job.jobStatus = JobStatus.IN_PROGRESS;
        // emit event
        emit JobAssigned(_jobID, msg.sender);
    }

    //Function Transfer funds in job completion
    function markJobComplete(uint256 _jobID) external idExist(_jobID) {
        //See the person calling is the freelancer
        Job storage job = JobList[_jobID];
        require(
            msg.sender == job.freelancer,
            "This function can be called only by the freelancer"
        );
        //Check if status is in progress
        require(
            job.jobStatus == JobStatus.IN_PROGRESS,
            "This function is not in progress"
        );
        //Change state to APPROVAL_PENDING
        job.jobStatus = JobStatus.APPROVAL_PENDING;
        //emit event
        emit MarkJobComplete(_jobID, msg.sender);
    }

    //Function to accept completed job and transfer funds
    function acceptJob(uint256 _jobID)
        external
        idExist(_jobID)
        jobOwner(_jobID)
    {
        Job storage job = JobList[_jobID];

        //Require job is in approval pending
        require(
            job.jobStatus == JobStatus.APPROVAL_PENDING,
            "This function is not in approval pending"
        );
        //Make Job finished
        job.jobStatus == JobStatus.FINISHED;
        //Transfer funds
        jobToken.transfer(payable(job.freelancer), job.price);
        // Emit event
        emit AcceptJob(_jobID, job.freelancer);
    }
}
