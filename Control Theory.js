import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { TouchType } from "../api/UI/properties/TouchType";
var id = "temperature_control";
var name = "Temperature Control";
var description =
  "Control Theory is a tool used in engineering to maintain a variable at a set value (known as the 'set point'). \n \n \
\
To make progress, you will need to disturb T to change rho. \
You will also need to grow the variable 'r', this grows faster when T is close to the setpoint, T_s. \
\n \n \
The controller works by calculating the error, e(t) between T and the set point, T_s. \
The controller used in this theory will be a PID -- proportional, integral and derivative controller. \
K_p represents the proportional gain of the system - in other words how much the output changes depending on the error sum within the brackets. \
The integral term sums up the past errors and attempts to minimise the error after t_i seconds.\
 The derivative term attempts to predict the future \error after t_d seconds based on the current derivative of e(t). \
At some point you will also be able to manually change the values k_p, t_i, t_d, \
and T_s to explore the system more deeply and to improve rho gain.\n \n \
\
In this theory, you will assume that this is a temperature control system. \
The PID controller either heats the system to raise temperature, or cools the system to lower temperature. \
This decision is based on the measured error e(t) and the output, u(t), is modelled as a percentage between -100% and 100%. \
(Note that behind the scenes some more advanced features such as 'anti-windup' are taking place, feel free to read further into the subject if you are curious.)";

var authors = "Gaunter#1337, peanut#6368 - developed the theory \n XLII#0042, SnaekySnacks#1161 - developed the sim and helped balancing";
var version = "1.6.2";
var publicationExponent = 0.2;
var achievements;
requiresGameVersion("1.4.29");

// Currency
var rho;

// UI Variables
var maxTdotText = Utils.getMath("\\text{Max } \\dot{T} \\text{ in current publication: } ");
var maxTdotLabel;
var cycleEstimateText = Utils.getMath("\\text{Average cycle } \\dot{T} \\text{: } ");
var cycleEstimateLabel;
var rEstimateText = Utils.getMath("\\text{Average cycle } \\dot{r} \\text{: } ");
var rEstimateLabel;
var rhoEstimateText = Utils.getMath("\\text{Average cycle } \\dot{\\rho} \\text{: } ");
var rhoEstimateLabel;
var autoTemperatureBar;

// UI image size
var getImageSize = (width) => {
  if(width >= 1080)
    return 48;
  if(width >= 720)
    return 36;
  if(width >= 360)
    return 24;
  return 20;
}

// System variables
var rhoEstimate, Tc, Th, d1, d0, fd1, fd0, r, T, output, kp, td, ti, setPoint, output, error, integral, systemDt, valve, timer, amplitude, frequency, autoKickerEnabled, baseTolerance, achievementMultiplier, publicationCount, cycleEstimate;
kp = 1;
cycleEstimate = BigNumber.ZERO;
rEstimate = BigNumber.ZERO;
ti = 5;
td = 0.2;
amplitude = 125;
autoKickerEnabled = false;
frequency = 1.2;
C1Base = 2.75;
r2ExponentScale = 0.03;
var maximumPublicationTdot;
var initialiseSystem = () => {
  timer = 0;
  T = BigNumber.from(100);
  r = BigNumber.from(1)
  cycleR = BigNumber.ZERO;
  valve = BigNumber.ZERO;
  integral = 0;
  error = [0, 0, 0];
  output = 0;
  d1 = 0;
  d0 = 0;
  fd1 = 0;
  fd0 = 0;
  Tc = 30;
  Th = 200;
  rEstimate = BigNumber.ZERO;
  rhoEstimate = BigNumber.ZERO;
  baseTolerance = 5;
  achievementMultiplier = 1;
  publicationCount = 0;
  maximumPublicationTdot = BigNumber.ZERO;
}
// Upgrades
var c1, r1, r2, r3, kickT, changePidValues, autoKick, exponentCap, achievementMultiplierUpgrade, tDotExponent;

// Milestones
var c1Exponent, rExponent, r1Exponent, r2Exponent, c1BaseUpgrade, unlockR3;

var init = () => {
  rho = theory.createCurrency();
  initialiseSystem();

  /////////////////////
  // Milestone Upgrades

  theory.setMilestoneCost(new CustomCost(total => BigNumber.from(getCustomCost(total))));
  // T Autokick
  {
    autoKick = theory.createMilestoneUpgrade(0, 1);
    autoKick.maxLevel = 1;
    autoKick.getDescription = (_) => "Automatically adjust T";
    autoKick.getInfo = (_) => "Automatically adjusts T";
    autoKick.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
    autoKick.canBeRefunded = () => false;
  }
  {
    c1Exponent = theory.createMilestoneUpgrade(1, 3);
    c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("c_1", 0.05)
    c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("c_1", "0.05")
    c1Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  {
    r1Exponent = theory.createMilestoneUpgrade(2, 3);
    r1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r_1", 0.05);
    r1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r_1", "0.05");
    r1Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }
  {
    r2Exponent = theory.createMilestoneUpgrade(3, 2);
    r2Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r_2", r2ExponentScale);
    r2Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r_2", r2ExponentScale);
    r2Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
    r2Exponent.canBeRefunded = () => unlockR3.level == 0 && rExponent.level == 0;
  }
  {
    c1BaseUpgrade = theory.createMilestoneUpgrade(4, 2);
    c1BaseUpgrade.getInfo = (_) => "Increases $c_1$ base by " + 0.125;
    c1BaseUpgrade.getDescription = (_) => "$\\uparrow \\ c_1$ base by " + 0.125;
    c1BaseUpgrade.boughtOrRefunded = (_) => updateAvailability();
    c1BaseUpgrade.canBeRefunded = () => unlockR3.level == 0 && rExponent.level == 0;
  }

  {
    rExponent = theory.createMilestoneUpgrade(5, 2);
    rExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r", 0.001);
  }
  rExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r", 0.001);
  rExponent.boughtOrRefunded = (_) => {
    updateAvailability(); theory.invalidatePrimaryEquation();
  }
  {
    unlockR3 = theory.createMilestoneUpgrade(6, 1);
    unlockR3.getDescription = (_) => Localization.getUpgradeAddTermDesc("r_3");
    unlockR3.getInfo = (_) => Localization.getUpgradeAddTermInfo("r_3");
    unlockR3.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }


  /////////////////////
  // Permanent Upgrades
  theory.createPublicationUpgrade(1, rho, 1e8);

  // PID Menu Unlock
  {
    changePidValues = theory.createPermanentUpgrade(2, rho, new LinearCost(1e8, 0));
    changePidValues.maxLevel = 1;
    changePidValues.getDescription = (_) => Localization.getUpgradeUnlockDesc("\\text{PID Menu}");
    changePidValues.getInfo = (_) => Localization.getUpgradeUnlockInfo("\\text{PID Menu}");
  }

  theory.createBuyAllUpgrade(3, rho, 1e10);
  theory.createAutoBuyerUpgrade(4, rho, 1e20);

  // Achievement Multiplier
  {
    achievementMultiplierUpgrade = theory.createPermanentUpgrade(6, rho, new CustomCost(_ => BigNumber.from(1e250).pow(2)));
    achievementMultiplierUpgrade.maxLevel = 1;
    achievementMultiplierUpgrade.getDescription = (_) => "Achievement multiplier"
    achievementMultiplierUpgrade.getInfo = (_) => "Multiplies income by " + calculateAchievementMultiplier().toPrecision(3);
  }
  // Tdot exponent cap 
  {
    exponentCap = theory.createPermanentUpgrade(7, rho, new CustomCost((level) => {
      switch (level) {
        case 0: return BigNumber.TEN.pow(350);
        case 1: return BigNumber.TEN.pow(390);
        case 2: return BigNumber.TEN.pow(440);
        case 3: return BigNumber.TEN.pow(535);
        case 4: return BigNumber.TEN.pow(585);
        case 5: return BigNumber.TEN.pow(635);
        case 6: return BigNumber.TEN.pow(685);
        case 7: return BigNumber.TEN.pow(725);
      }
    }
    ));
    exponentCap.getDescription = (_) => Localization.getUpgradeIncCustomInfo("\\dot{T} \\text{ exponent cap}", 2)
    exponentCap.getInfo = (_) => Localization.getUpgradeIncCustomInfo("\\dot{T} \\text{ exponent cap}", 2)
    exponentCap.maxLevel = 8;
    exponentCap.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  /////////////////////
  // Upgrades

  // Kick T
  {
    kickT = theory.createUpgrade(0, rho, new FreeCost())
    kickT.getDescription = (_) => Utils.getMath("\\text{Set T to } 125");
    kickT.getInfo = (_) => Utils.getMath("T \\rightarrow 125");
    kickT.bought = (_) => T = amplitude;
  }

  // c1
  {
    let getDesc = (level) => "c_1= " + (C1Base + c1BaseUpgrade.level * 0.125).toString() + "^{" + level + "}";
    let getInfo = (level) => "c_1=" + getC1(level).toString();
    c1 = theory.createUpgrade(1, rho, new ExponentialCost(1e5, Math.log2(18)));
    c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
    c1.getInfo = (amount) => Utils.getMathTo(getInfo(c1.level), getInfo(c1.level + amount));
  }

  // r1
  {
    let getDesc = (level) => "r_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0);
    let getInfo = (level) => "r_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0);
    r1 = theory.createUpgrade(2, rho, new ExponentialCost(10, Math.log2(3)));
    r1.getDescription = (_) => Utils.getMath(getDesc(r1.level));
    r1.getInfo = (amount) => Utils.getMathTo(getInfo(r1.level), getInfo(r1.level + amount));
  }

  // r2
  {
    let getDesc = (level) => "r_2= 2^{" + level + "}";
    let getInfo = (level) => "r_2=" + getR2(level).toString(0);
    r2 = theory.createUpgrade(3, rho, new ExponentialCost(1000, Math.log2(8)));
    r2.getDescription = (_) => Utils.getMath(getDesc(r2.level));
    r2.getInfo = (amount) => Utils.getMathTo(getInfo(r2.level), getInfo(r2.level + amount));
  }
  // r3
  {
    let getDesc = (level) => "r_3= e^{" + level + "}";
    let getInfo = (level) => "r_3=" + getR3(level).toString(2);
    r3 = theory.createUpgrade(4, rho, new ExponentialCost(1e220, Math.log2(10 ** 2.12)));
    r3.getDescription = (_) => Utils.getMath(getDesc(r3.level));
    r3.getInfo = (amount) => Utils.getMathTo(getInfo(r3.level), getInfo(r3.level + amount));
    r3.isAvailable = unlockR3.level > 0;
  }
  //Tdot exponent
  {
    let getInfo = (level) => "\\dot{T}^{" + (level + 2) + "}";
    let getDesc = (_) => Localization.getUpgradeIncCustomExpDesc("\\dot{T}", 1);
    tDotExponent = theory.createUpgrade(5, rho, new ExponentialCost(1e15, Math.log2(7500)));
    tDotExponent.maxLevel = 50 + exponentCap.level*2;
    tDotExponent.getDescription = (_) => getDesc(tDotExponent.level);
    tDotExponent.getInfo = (amount) => Utils.getMathTo(getInfo(tDotExponent.level), getInfo(tDotExponent.level + amount))
    tDotExponent.bought = (_) => theory.invalidatePrimaryEquation();
  }
  systemDt = 0.1;
  setPoint = 100;

  /////////////////////
  // Achievements

  let achievement_category1 = theory.createAchievementCategory(0, "R");
  let achievement_category2 = theory.createAchievementCategory(1, "Milestones");
  let achievement_category3 = theory.createAchievementCategory(2, "Publications");
  let achievement_category4 = theory.createAchievementCategory(3, "Challenges (1e100τ+)");
  let achievement_category5 = theory.createAchievementCategory(4, "Challenges (1e120τ+)");
  achievements = [

    // Temperature
    theory.createAchievement(0, achievement_category1, "R is for research", "Have r exceed 1e20.", () => r > BigNumber.from(1e20)),
    theory.createAchievement(1, achievement_category1, "Bench-scale research", "Have r exceed 1e50", () => r > BigNumber.from(1e50)),
    theory.createAchievement(2, achievement_category1, "Pilot-scale research", "Have r exceed 1e110", () => r > BigNumber.from(1e110)),

    // Milestones
    theory.createAchievement(3, achievement_category2, "Junior Engineer", "Reach 1e10τ.", () => theory.tau > BigNumber.from(1e10)),
    theory.createAchievement(4, achievement_category2, "Senior Engineer", "Reach 1e25τ.", () => theory.tau > BigNumber.from(1e25)),
    theory.createAchievement(5, achievement_category2, "Prinicipal Engineer", "Reach 1e50τ.", () => theory.tau > BigNumber.from(1e50)),
    theory.createAchievement(6, achievement_category2, "Googol Engineer", "Reach 1e100τ.", () => theory.tau > BigNumber.from(1e100)),

    // Publications
    theory.createAchievement(7, achievement_category3, "Research Intern", "Publish 5 times.", () => publicationCount >= 5),
    theory.createAchievement(8, achievement_category3, "R&D Engineer", "Publish 10 times.", () => publicationCount >= 10),
    theory.createAchievement(9, achievement_category3, "\"That's Dr., not Mr.\"", "Publish 25 times.", () => publicationCount >= 25),

    // Challenges

    // 1e100τ 
    theory.createAchievement(10, achievement_category4, "Don't need it.", "Have ρ exceed 1e165 without purchasing a T dot exponent upgrade.", () => (rho.value > BigNumber.from(1e165) && tDotExponent.level == 0)),
    theory.createAchievement(11, achievement_category4, "What does 'r' do again?", "Have ρ exceed 1e110 while r is still 1.", () => (rho.value > BigNumber.from(1e110) && r == BigNumber.ONE)),
    theory.createAchievement(12, achievement_category4, "Temperature Control Challenge 1", "Have ρ exceed 1e300 while keeping T dot below 20. (You must also have a setpoint and amplitude difference of at least 40. No cheating!)", () => (rho.value > BigNumber.from(1e300) && Math.abs(setPoint - amplitude) >= 40 && maximumPublicationTdot <= 20)),
    theory.createAchievement(13, achievement_category4, "Temperature Control Challenge 2", "Have ρ exceed 1e245 while keeping T dot below 10. (You must also have a setpoint and amplitude difference of at least 40. No cheating!)", () => (rho.value > BigNumber.from(1e245) && Math.abs(setPoint - amplitude) >= 40 && maximumPublicationTdot <= 10)),
    theory.createAchievement(14, achievement_category4, "Optimisation Challenge 1", "Have ρ exceed 1e70 within 25 upgrade purchases and no T dot exponent upgrades.", () => (rho.value > BigNumber.from(1e70) && (c1.level + r1.level + r2.level + r3.level) <= 25) && tDotExponent.level == 0),

    // 1e120τ
    theory.createAchievement(15, achievement_category5, "You can upgrade that?", "Have ρ exceed 1e230 without purchasing a T dot exponent upgrade.", () => (rho.value > BigNumber.from(1e230) && tDotExponent.level == 0)),
    theory.createAchievement(16, achievement_category5, "Does 'r' actually do anything?", "Have ρ exceed 1e124 while r is still 1.", () => (rho.value > BigNumber.from(1e124) && r == BigNumber.ONE)),
    theory.createAchievement(17, achievement_category5, "Temperature Control Challenge 3", "Have ρ exceed 1e360 while keeping T dot below 20. (You must also have a setpoint and amplitude difference of at least 40. No cheating!)", () => (rho.value > BigNumber.from(1e300) * 1e60 && Math.abs(setPoint - amplitude) >= 40 && maximumPublicationTdot <= 20)),
    theory.createAchievement(18, achievement_category5, "Temperature Control Challenge 4", "Have ρ exceed 1e300 while keeping T dot below 10. (You must also have a setpoint and amplitude difference of at least 40. No cheating!)", () => (rho.value > BigNumber.from(1e300) && Math.abs(setPoint - amplitude) >= 40 && maximumPublicationTdot <= 5)),
    theory.createAchievement(19, achievement_category5, "Optimisation Challenge 2", "Have ρ exceed 1e80 within 20 upgrade purchases and no T dot exponent upgrades.", () => (rho.value > BigNumber.from(1e80) && (c1.level + r1.level + r2.level + r3.level) <= 20) && tDotExponent.level == 0),
  ];
  updateAvailability();
}

////////////////////////////
// Story Chapters

// Unlocked at the beginning
let storychapter_1 =
  "You are currently working on a new system that will be used to control the temperature of your lab. \n \
The only problem is you are struggling with the maths. \n \
You decide to approach the mathematics department for help. \n \
Unfortunately, the professor is not very friendly. They scoff at you because you are 'only' an engineering student.\n \
Frustrated, you return to your lab and kick the system.";
theory.createStoryChapter(0, "Applied Mathematics", storychapter_1, () => true);

// Unlocked after buying the first 'free' upgrade
let storychapter_2 =
  "You kick the system and it starts working. \n \
You aren't sure what is happening but it seems to be generating something. \n \
You notice this happens each time the temperature changes. \n \n \
Perhaps this is some sort of chain reaction? You decide to investigate further.";
theory.createStoryChapter(1, "Chain Reaction", storychapter_2, () => kickT.level > 0);

// Unlocked after buying the first 'r1' upgrade
let storychapter_3 =
  "After a bit more investigation you still aren't quite sure what is happening. \n \
You decide to walk away and come back later. \n \
When you return, you notice another variable is growing. \n \
This seems to grow faster when the temperature is close to the set point. \n \
You decide to call this variable 'r' to represent research.";
theory.createStoryChapter(2, "Research", storychapter_3, () => r1.level > 0);

// Unlocked after collecting the first milestone
let storychapter_4 =
  "You are making progress in your research, however your foot is beginning to get sore from the constant kicking. \n \
You decide to visit the computer science department to help you out. \n \
They provide you with a software package that can adjust the temperature of the system automatically.  \
"
theory.createStoryChapter(3, "Automation", storychapter_4, () => autoKick.level > 0);

//c1Base milestone reaches level 2
let storychapter_5 =
  "After analysing the equation a bit more you come to a realisation. \n \
\"I'm an engineer. I can round numbers!\" \n \
Why didn't you notice this earlier? \n \
You finally decide to round c1 up to 3. \
";
theory.createStoryChapter(4, "Rounding", storychapter_5, () => c1BaseUpgrade.level >= 2);

// T dot exponent max level reached
let storychaper_6 =
  "You suddenly hear a strange noise coming from the machine. \n \
The system has been pushed to its limit. \n \
You notice that the motor is dangerously close to burning out. \n \
For now, it's best to avoid increasing the exponent of the temperature change. \
";
theory.createStoryChapter(5, "Physical Limitations", storychaper_6, () => tDotExponent.level >= 48);

// r3 unlocked
let storychapter_7 =
  "The mathematics department is taking notice of your work. \n \
They decide to help refine the maths of your system. \n \
while puzzled at first, the mathematics professor eventually adds a new variable to your existing work. \n \
\"That should make the numbers grow much faster!\" they exclaim! \n \
You aren't sure why mathematicians are obsessed with 'e' but you decide to go along with it.";
theory.createStoryChapter(6, "Refinement", storychapter_7, () => unlockR3.level >= 1);

// T dot exponent cap reached
let storychapter_8 =
  "You believe you have explored all the theoretical, mathematical possibilities with the system. \n \
You decide to take another look at the practical elements. \n \
Remembering earlier that the motor was close to burning out, you apply for a more powerful motor. \n \
The Dean of the university approves your request. They even offer to supply better motors if you show even more promising results. \
";
theory.createStoryChapter(7, "De-bottlenecking", storychapter_8, () => exponentCap.level >= 1);

// 1e90 tau
let storychapter_9 =
  "The Dean contacts you to let you know that the engineering world has taken note of your system. \n \
They say that you have been nominated for an award for your work. \n \
You decide to put some finishing touches on your work to impress the awards committee."
theory.createStoryChapter(8, "Nomination", storychapter_9, () => theory.tau > BigNumber.from(1e90));

// 1e100 tau
let storychaper_10 =
  "The awards committee was so impressed with your work that they decide to give you a prize. \n \
You are asked to give a speech about your work. \n \
You say that a lot of hard work has gone into this project. \n \
However, there is still a bit more to be done. \n \
The committee gasps. \n \
You explain that reflecting on your past 'achievements', you believe you have found a way to make the system even more efficient. \n \
They reply that they have high expectations for your future work. \n \
The End \n \
? \
";
theory.createStoryChapter(9, "The End?", storychaper_10, () => theory.tau > BigNumber.from(1e100));

// All achievements unlocked
let storychaper_11 =
  "You were able to make the system efficient beyond your wildest dreams. \n \
You have achieved a high level of greatness. There are no more possibilities for improvement. \n \
Now you just need to sit back and let the system run. \n \
You are truly the master of Temperature Control. \n \
The End \n \
"
theory.createStoryChapter(10, "Master of Control", storychaper_11, () => achievementMultiplier >= 50);
{
  // Internal
  var calculateAchievementMultiplier = () => {
    let count = 0;
    for (const achievement of achievements) {
      if (achievement.isUnlocked) {
        count++
      }
    }
    return Math.pow(30, 0.05 * count);
  }

  var updateAvailability = () => {
    kickT.isAvailable = autoKick.level == 0;
    c1Exponent.isAvailable = autoKick.level >= 1;
    r1Exponent.isAvailable = autoKick.level >= 1;
    r2Exponent.isAvailable = c1Exponent.level >= 3 && r1Exponent.level >= 3;
    c1BaseUpgrade.isAvailable = c1Exponent.level >= 3 && r1Exponent.level >= 3;
    rExponent.isAvailable = r2Exponent.level >= 2 && c1BaseUpgrade.level >= 2;
    unlockR3.isAvailable = rExponent.level >= 2;
    r3.isAvailable = unlockR3.level > 0;
    tDotExponent.maxLevel = 50 + exponentCap.level * 2;
  }

  var getInternalState = () => `${T.toString()} ${error[0].toString()} ${integral.toString()} ${kp.toString()} ${ti.toString()} ${td.toString()} ${valve.toString()} ${publicationCount.toString()} ${r} ${autoKickerEnabled} ${cycleEstimate} ${setPoint} ${rEstimate} ${amplitude} ${frequency} ${maximumPublicationTdot}`;

  var setInternalState = (state) => {
    debug = state;
    let values = state.split(" ");
    if (values.length > 0) T = parseFloat(values[0]);
    if (values.length > 1) error[0] = parseFloat(values[1]);
    if (values.length > 2) integral = parseFloat(values[2]);
    if (values.length > 3) kp = parseFloat(values[3]);
    if (values.length > 4) ti = parseFloat(values[4]);
    if (values.length > 5) td = parseFloat(values[5]);
    if (values.length > 6) valve = parseFloat(values[6]);
    if (values.length > 7) publicationCount = parseFloat(values[7])
    if (values.length > 8) r = parseBigNumber(values[8]);
    if (values.length > 9) autoKickerEnabled = values[9] == "true";
    if (values.length > 10) cycleEstimate = parseBigNumber(values[10]);
    if (values.length > 11) setPoint = parseFloat(values[11]);
    if (values.length > 12) rEstimate = parseBigNumber(values[12]);
    if (values.length > 13) amplitude = parseFloat(values[13]);
    if (values.length > 14) frequency = parseFloat(values[14]);
    if (values.length > 15) maximumPublicationTdot = parseBigNumber(values[15]);
  }

  var updatePidValues = () => {
    kp = newKp;
    td = newTd;
    ti = newTi;
    setPoint = newSetPoint;
    theory.invalidateSecondaryEquation();
  }

  var newKp = kp;
  var newTi = ti;
  var newTd = td;
  var newSetPoint = setPoint;

  // Allows the user to reset post e100 tau for challenge runs
  var canResetStage = () => theory.tau > BigNumber.from(1e100);

  var getEquationOverlay = () => {
    return ui.createGrid({
      columnDefinitions: ["1*", "3*", "1*"],
      columnSpacing: 0,
      children: [
        ui.createImage({
          source: ImageSource.fromUri("https://raw.githubusercontent.com/lrobt97/Control-Theory/main/auto_adjuster_icon.png"),
          useTint: true,
          widthRequest: getImageSize(ui.screenWidth),
          heightRequest: getImageSize(ui.screenWidth),
          aspect: Aspect.ASPECT_FILL,
          onTouched: (e) => {
            if (e.type.isReleased()) {
              let autoKickMenu = createAutoKickerMenu();
              autoKickMenu.show();
            }
          },
          isVisible: () => autoKick.level > 0,
          row: 0,
          column: 0,
          horizontalOptions: LayoutOptions.START,
          verticalOptions: LayoutOptions.START,
        }),
        ui.createFrame({
          isVisible: () => autoKickerEnabled,
          row: 0,
          column: 1,
          horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
          verticalOptions: LayoutOptions.START,
          children: [
            autoTemperatureBar = ui.createProgressBar({
              progress: timer / frequency,
            }),
          ],
        }),
        ui.createImage({
          useTint: false,
          source: ImageSource.fromUri("https://raw.githubusercontent.com/lrobt97/Control-Theory/main/pid_menu_icon.png"),
          widthRequest: getImageSize(ui.screenWidth),
          heightRequest: getImageSize(ui.screenWidth),
          aspect: Aspect.ASPECT_FILL,
          onTouched: (e) => {
            if (e.type.isReleased()) {
              let pidMenu = createPidMenu();
              pidMenu.show();
            }
          },
          isVisible: () => changePidValues.level > 0,
          row: 0,
          column: 2,
          horizontalOptions: LayoutOptions.END,
          verticalOptions: LayoutOptions.START,
        }),
      ]
    })
  }
  const createAutoKickerMenu = () => {
    let amplitudeText = "Amplitude of T: ";
    let frequencyText = "Frequency in seconds: ";
    let amplitudeLabel, frequencyLabel;
    let amplitudeSlider, frequencySlider;
    let menu = ui.createPopup({
      title: "Temperature Adjuster",
      content: ui.createStackLayout({
        children: [
          amplitudeLabel = ui.createLabel({ text: amplitudeText + amplitude.toPrecision(3) }),
          amplitudeSlider = ui.createSlider({
            onValueChanged: () => amplitudeLabel.text = amplitudeText + amplitudeSlider.value.toPrecision(3),
          }),
          frequencyLabel = ui.createLabel({ text: frequencyText + frequency.toPrecision(3) }),
          frequencySlider = ui.createSlider({
            onValueChanged: () => frequencyLabel.text = frequencyText + frequencySlider.value.toPrecision(3),
          }),
          ui.createLabel({ text: "Off/On" }),
          autoKickerSwitch = ui.createSwitch({
            isToggled: () => autoKickerEnabled,
            onTouched: (e) => { if (e.type == TouchType.PRESSED) autoKickerEnabled = !autoKickerEnabled }
          }),
          maxTdotLabel = ui.createLatexLabel({ text: maxTdotText + maximumPublicationTdot.toString() }),
          cycleEstimateLabel = ui.createLatexLabel({ text: cycleEstimateText + cycleEstimate.toString() }),
          rEstimateLabel = ui.createLatexLabel({ text: rEstimateText + rEstimate.toString() }),
          rhoEstimateLabel = ui.createLatexLabel({ text: rhoEstimateText + rhoEstimate.toString() }),
          ui.createButton({
            text: "Update",
            onClicked: () => {
              amplitude = amplitudeSlider.value;
              frequency = frequencySlider.value
            }
          }),
        ]
      })
    })
    amplitudeSlider.maximum = Th;
    amplitudeSlider.minimum = Tc;
    amplitudeSlider.value = amplitude;
    frequencySlider.maximum = 60;
    frequencySlider.minimum = 1;
    frequencySlider.value = frequency;
    return menu;
  }
  const createPidMenu = () => {
    let kpText = "{K}_{p} = ";
    let tiText = "{t}_{i} = ";
    let tdText = "{t}_{d} = ";
    let setPointText = "{T}_{s} = "
    let kpTextLabel, tiTextLabel, tdTextLabel, setPointTextLabel;
    let kpSlider, tiSlider, tdSlider, setPointSlider;
    let menu = ui.createPopup({
      title: "Configure PID",
      content: ui.createStackLayout({
        children: [
          ui.createLatexLabel({
            horizontalTextAlignment: TextAlignment.CENTER,
            verticalTextAlignment: TextAlignment.CENTER,
            fontSize: 12,
            text: Utils.getMath("\\begin{matrix} e(t) = T_{s} - T \\\\ u(t) = K_p(e(t) + \\frac{1}{t_i}\\int_{0}^{t}e(\\tau)d\\tau \\ + t_d \\dot{e(t)}) \\end{matrix}")
          }),
          kpTextLabel = ui.createLatexLabel({ text: Utils.getMath(kpText + kp.toString()) }),
          kpSlider = ui.createSlider({
            value: Math.log10(kp),
            minimum: -2,
            maximum: 1,
            onValueChanged: () => {
              kpTextLabel.text = Utils.getMath(kpText + Math.pow(10, kpSlider.value).toPrecision(2).toString());
              newKp = Math.pow(10, kpSlider.value);
            },
          }),
          tiTextLabel = ui.createLatexLabel({ text: Utils.getMath(tiText + ti.toString()) }),
          tiSlider = ui.createSlider({
            value: Math.log10(ti),
            minimum: -1.5,
            maximum: 1,
            onValueChanged: () => {
              tiTextLabel.text = Utils.getMath(tiText + Math.pow(10, tiSlider.value).toPrecision(2).toString());
              newTi = Math.pow(10, tiSlider.value);
            },
          }),
          tdTextLabel = ui.createLatexLabel({ text: Utils.getMath(tdText + td.toString()) }),
          tdSlider = ui.createSlider({
            value: Math.log10(td),
            minimum: -1.5,
            maximum: 1,
            onValueChanged: () => {
              tdTextLabel.text = Utils.getMath(tdText + Math.pow(10, tdSlider.value).toPrecision(2).toString());
              newTd = Math.pow(10, tdSlider.value);
            },
          }),
          setPointTextLabel = ui.createLatexLabel({ text: Utils.getMath(setPointText + setPoint.toPrecision(3)) }),
          setPointSlider = ui.createSlider({
            onValueChanged: () => {
              setPointTextLabel.text = Utils.getMath(setPointText + setPointSlider.value.toPrecision(3));
              newSetPoint = setPointSlider.value;
            },
          }),
          ui.createButton({ text: "Update", onClicked: updatePidValues })
        ]
      })
    })
    setPointSlider.maximum = Th;
    setPointSlider.minimum = Tc;
    setPointSlider.value = setPoint;
    return menu;
  }

  var resetStage = () => {
    c1.level = 0;
    r1.level = 0;
    r2.level = 0;
    r3.level = 0;
    tDotExponent.level = 0;
    rho.value = BigNumber.ZERO;
    initialiseSystem();
  }

  var tick = (elapsedTime, multiplier) => {
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;
    achievementMultiplier = calculateAchievementMultiplier();
    timer += systemDt;
    if (timer > frequency && autoKickerEnabled == true) {
      // Calculates the root mean square
      cycleEstimate = (cycleEstimate / (frequency / systemDt)).sqrt();
      if (cycleEstimateLabel) cycleEstimateLabel.text = cycleEstimateText + cycleEstimate.toString();
      cycleEstimate = BigNumber.ZERO;
      cycleR = BigNumber.ZERO;
      T = amplitude;
      timer = 0;
      integral = 0;
    }
    autoTemperatureBar.progress = (timer <= frequency) * timer / (frequency);
    error[1] = error[0];
    error[0] = setPoint - T;
    integral += error[0];
    let derivative = (error[0] - error[1]) / systemDt;
    // Anti-windup scheme
    if (integral > 100) integral = 100;
    if (integral < -100) integral = -100;
    if (Math.abs(error[0]) > 10) integral = 0;
    output = kp * (error[0] + systemDt / ti * integral + td * derivative);

    // Output and integral clamping mechanism
    if (output > 100) {
      valve = 1
      integral -= output - 100;
    }
    else if (output < -100) {
      valve = -1;
      integral += -100 - output;
    }
    else {
      valve = output / 100;
    }

    let dT = 0;
    let prevT = T;

    if (valve > 0) {
      T = Th + (T - Th) * BigNumber.E.pow(-1 * Math.abs(valve) * systemDt)
    } else if (valve < 0) {
      T = Tc + (T - Tc) * BigNumber.E.pow(-1 * Math.abs(valve) * systemDt)
    }

    let dr = getR1(r1.level).pow(getR1Exp(r1Exponent.level)) * getR2(r2.level).pow(getR2Exp(r2Exponent.level)) * getR3((unlockR3.level > 0) * r3.level) / (1 + Math.log10(1 + Math.abs(error[0])));
    rEstimate = rEstimate * 0.95 + dr * 0.05;
    dT = BigNumber.from((T - prevT) / systemDt).abs();
    if (dT > maximumPublicationTdot) maximumPublicationTdot = dT;
    // Required sum for root mean square calculation
    cycleEstimate += dT.pow(2);
    r += dr * dt;
    let value_c1 = getC1(c1.level).pow(getC1Exp(c1Exponent.level));
    let dRho = r.pow(getRExp(rExponent.level)) * BigNumber.from(value_c1 * dT.pow(getTdotExponent(tDotExponent.level))).sqrt() * bonus;
    rho.value += dt * dRho;
    rhoEstimate = rhoEstimate * 0.95 + dRho * 0.05;

    // UI Updates
    if (rEstimateLabel) rEstimateLabel.text = rEstimateText + rEstimate.toString();
    if (maxTdotLabel) maxTdotLabel.text = maxTdotText + maximumPublicationTdot.toString();
    if (rhoEstimateLabel) rhoEstimateLabel.text = rhoEstimateText + rhoEstimate.toString();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
  }
}


{
  // Equations

  var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 120;
    theory.primaryEquationScale = 1;
    let result = "\\begin{matrix}"

    let c1_exp = c1Exponent.level > 0 ? getC1Exp(c1Exponent.level).toNumber() : "";
    let r_exp = rExponent.level > 0 ? getRExp(rExponent.level).toNumber() : "";
    let r1_exp = r1Exponent.level > 0 ? getR1Exp(r1Exponent.level).toNumber() : "";
    let r2_exp = r2Exponent.level > 0 ? getR2Exp(r2Exponent.level).toNumber() : "";
    let r3_string = unlockR3.level > 0 ? "r_3" : "";
    result += "\\dot{\\rho} = r^{" + r_exp + "}\\sqrt{c_1^{" + c1_exp + "}\\dot{T}^{" + getTdotExponent(tDotExponent.level) + "}}";
    result += "\\\\ \\dot{r} = \\frac{r_1^{" + r1_exp + "} r_2^{" + r2_exp + "} " + r3_string + "}{1+\\log_{10}(1 + \|e(t)\|)}"
    result += "\\\\ \\dot{T} = \\left\\{ \\begin{array}{cl} u(t)(" + Th + " - T) & : \\ u(t) > 0\\\\ u(t)(T - " + Tc + ") & : \\ u(t) < 0 \\end{array} \\right.\\\\";
    result += "\\end{matrix}"
    return result;
  }

  var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 75;
    theory.secondaryEquationScale = 0.9;
    let result = "\\begin{array}{c}";

    result += "e(t) = T_{s} - T \\\\";
    result += "u(t) = " + valve.toString() + " \\\\";
    result += theory.latexSymbol + "=\\max\\rho^{" + publicationExponent + "}";
    result += "\\end{array}"
    return result;
  }

  var getTertiaryEquation = () => {
    let result = "";
    result += "T =" + Math.fround(T).toPrecision(5);
    result += ",\\,T_{s} =" + setPoint.toPrecision(3) + ",\\ e(t) = " + Math.fround(error[0]).toPrecision(3);
    result += ",\\, r =" + r;
    return result;
  }
}
var getCustomCost = (level) => {
  let result = 1;
  switch (level) {
    case 0: result = 10; break; // autoKicker
    case 1: result = 35; break; // r1Exponent and c1Exponent
    case 2: result = 60; break;
    case 3: result = 85; break;
    case 4: result = 110; break;
    case 5: result = 125; break;
    case 6: result = 150; break;
    case 7: result = 175; break; // r2Exponent and c1Base
    case 8: result = 215; break;
    case 9: result = 235; break;
    case 10: result = 270; break;
    case 11: result = 290; break; // rExponent
    case 12: result = 315; break;
    case 13: result = 440; break; // r3
  }
  return result * 0.2;
}
var getC1Exp = (level) => BigNumber.from(1 + c1Exponent.level * 0.05);
var getRExp = (level) => BigNumber.from(1 + rExponent.level * 0.001);
var getR1Exp = (level) => BigNumber.from(1 + r1Exponent.level * 0.05);
var getR2Exp = (level) => BigNumber.from(1 + r2Exponent.level * r2ExponentScale);
var getC1 = (level) => BigNumber.from(C1Base + c1BaseUpgrade.level * 0.125).pow(level);
var getR1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);
var getR2 = (level) => BigNumber.TWO.pow(level);
var getR3 = (level) => BigNumber.E.pow(level);
var getTdotExponent = (level) => 2 + level;
var getPublicationMultiplier = (tau) => achievementMultiplierUpgrade.level >= 1 ? achievementMultiplier * tau.pow(0.5) / 2 : tau.pow(0.5) / 2;
var getPublicationMultiplierFormula = (symbol) => (achievementMultiplierUpgrade.level >= 1 ? BigNumber.from(achievementMultiplier).toString(2) + "\\times \\frac{" + symbol + "^{0.5}}{2}" : "\\frac{" + symbol + "^{0.5}}{2}");
var get2DGraphValue = () => (BigNumber.ONE + T).toNumber();
var getTau = () => rho.value.pow(publicationExponent);
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(5), rho.symbol];
var postPublish = () => {
  initialiseSystem();
  theory.invalidatePrimaryEquation();
  theory.invalidateTertiaryEquation();
  publicationCount++;
}
init();
