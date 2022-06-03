import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";

var id = "temperature_control";
var name = "Temperature Control";
var description = "Control Theory is a tool used in engineering to maintain a variable at a set value (known as the 'set point'). \n \n To make progress, you will need to disturb T to change rho, however going over a certain threshold will reset your progress. You will also need to grow the variable 'r', this grows faster when T is close to the setpoint, T_sp. \n \n The controller works by calculating the error, e(t) between T and the set point, T_sp. The controller used in this theory will be a PID -- proportional, integral and derivative controller. K_p represents the proportional gain of the system - in other words how much the output changes depending on the error sum within the brackets. The integral term sums up the past errors and attempts to minimise the error after t_i seconds. The derivative term attempts to predict the future error after t_d seconds based on the current derivative of e(t). At some point you will also be able to manually change the values k_p, t_i, t_d, and T_sp to explore the system more deeply and to improve rho gain.\n \n For this example, you will assume that this is a heating controller system. The PID controller will adjust the heater so that T reaches the set point. For the purpose of the simulation, u(t) will be considered as a percentage change, in the real world this would correspond to opening a valve to allow heating/cooling fluid to change the temperature. \n \n "; 
var authors = "Gaunter#7599, peanut#6368 - developed the theory \n XLII#0042, SnaekySnacks#1161 - developed the sim and helped balancing";
var version = "1.4.5";
var publicationExponent = 0.2;
var achievements;
requiresGameVersion("1.4.29");
// Currency
var rho;

// UI Variables
var cycleEstimateText = Utils.getMath("\\text{Average cycle } \\dot{T} \\text{: } ");
var cycleEstimateLabel;
var rEstimateText = Utils.getMath("\\text{Average cycle } \\dot{r} \\text{: } ");
var rEstimateLabel;


// System variables
var Tc, Th, d1, d0, fd1, fd0, r, T, output, kp, td, ti, setPoint, output, error, integral, systemDt, valve, timer, amplitude, frequency, autoKickerEnabled, baseTolerance, achievementMultiplier, publicationCount, cycleEstimate;
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
baseTolerance = 5;
achievementMultiplier = 1;
publicationCount = 0;
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
    unlockR3 = theory.createMilestoneUpgrade(3, 1);
    unlockR3.getDescription = (_) => Localization.getUpgradeAddTermDesc("r_3");
    unlockR3.getInfo = (_) => Localization.getUpgradeAddTermInfo("r_3");
    unlockR3.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }
  {
    r2Exponent = theory.createMilestoneUpgrade(4, 2);
    r2Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r_2", r2ExponentScale);
    r2Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r_2", r2ExponentScale);
    r2Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }
  {
    c1BaseUpgrade = theory.createMilestoneUpgrade(5, 2);
    c1BaseUpgrade.getInfo = (_) => "Increases $c_1$ base by " + 0.125;
    c1BaseUpgrade.getDescription = (_) => "$\\uparrow \\ c_1$ base by " + 0.125;
    c1BaseUpgrade.boughtOrRefunded = (_) => updateAvailability();
  }

  {
    rExponent = theory.createMilestoneUpgrade(6, 2);
    rExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r", 0.04);  }
    rExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r", 0.1);
    rExponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation();
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
    achievementMultiplierUpgrade.getInfo = (_) => "Multiplies income by " + achievementMultiplier.toPrecision(3);
  }
  // Tdot exponent cap 
  {
    exponentCap = theory.createPermanentUpgrade(7, rho, new CustomCost((level) => BigNumber.TEN.pow(375)*(BigNumber.TEN.pow(57.5).pow(level))));
    exponentCap.getDescription = (_) => Localization.getUpgradeIncCustomInfo("\\dot{T} \\text{ exponent cap}", 6)
    exponentCap.getInfo = (_) => Localization.getUpgradeIncCustomInfo("\\dot{T} \\text{ exponent cap}", 6)
    exponentCap.bought = (_) => tDotExponent.maxLevel = 48 + exponentCap.level*6;
    exponentCap.maxLevel = 7;
  }

  /////////////////////
  // Upgrades

  // Kick T
  {
    kickT = theory.createUpgrade(0, rho, new FreeCost())
    kickT.getDescription = (_) => Utils.getMath("T=125");
    kickT.getInfo = (_) => Utils.getMathTo("T=" + T, "T=125");
    kickT.bought = (_) => T = amplitude;
  }

  // c1
  {
    let getDesc = (level) => "c_1= "+ (C1Base + c1BaseUpgrade.level * 0.125).toString() + "^{" + level + "}";
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
    r2 = theory.createUpgrade(3, rho, new ExponentialCost(15, Math.log2(8)));
    r2.getDescription = (_) => Utils.getMath(getDesc(r2.level));
    r2.getInfo = (amount) => Utils.getMathTo(getInfo(r2.level), getInfo(r2.level + amount));
  }
  // r3
  {
    let getDesc = (level) => "r_3= 5^{" + level + "}";
    let getInfo = (level) => "r_3=" + getR3(level).toString(0);
    r3 = theory.createUpgrade(4, rho, new ExponentialCost(1e100, Math.log2(1e8)));
    r3.getDescription = (_) => Utils.getMath(getDesc(r3.level));
    r3.getInfo = (amount) => Utils.getMathTo(getInfo(r3.level), getInfo(r3.level + amount));
    r3.isAvailable = unlockR3.level > 0;
  }
  //Tdot exponent
  {
    let getInfo = (level) => "\\dot{T}^{" + level + "}";
    let getDesc = (_) => Localization.getUpgradeIncCustomExpDesc("\\dot{T}", 1);
    tDotExponent = theory.createUpgrade(5, rho, new ExponentialCost(1e6, Math.log2(10**4)));
    tDotExponent.maxLevel = 48;
    tDotExponent.getDescription = (_) => getDesc(tDotExponent.level);
    tDotExponent.getInfo = (amount) => Utils.getMathTo(getInfo(tDotExponent.level), getInfo(tDotExponent.level + amount))
    tDotExponent.bought = (_) => theory.invalidatePrimaryEquation();
  }
  systemDt = 1;
  setPoint = 100;

  /////////////////////
  // Achievements

  let achievement_category1 = theory.createAchievementCategory(0, "R");
  let achievement_category2 = theory.createAchievementCategory(1, "Milestones");
  let achievement_category3 = theory.createAchievementCategory(2, "Publications");

  achievements = [

    // Temperature
    theory.createAchievement(0, achievement_category1, "R is for research", "Have r exceed 1e20.", () => r > BigNumber.from(1e20)),
    theory.createAchievement(1, achievement_category1, "Bench-scale research", "Have r exceed 1e50", () => r < BigNumber.from(1e50)),
    theory.createAchievement(2, achievement_category1, "Pilot-scale research", "Have r exceed 1e110", () => r < BigNumber.from(1e110)),

    // Milestones
    theory.createAchievement(3, achievement_category2, "Junior Engineer", "Reach 1e10τ.", () => theory.tau > BigNumber.from(1e10)),
    theory.createAchievement(4, achievement_category2, "Senior Engineer", "Reach 1e25τ.", () => theory.tau > BigNumber.from(1e25)),
    theory.createAchievement(5, achievement_category2, "Prinicipal Engineer", "Reach 1e50τ.", () => theory.tau > BigNumber.from(1e50)),
    theory.createAchievement(6, achievement_category2, "Googol Engineer", "Reach 1e100τ.", () => theory.tau > BigNumber.from(1e100)),

    // Publications
    theory.createAchievement(7, achievement_category3, "Research Intern", "Publish 5 times.", () => publicationCount >= 5),
    theory.createAchievement(8, achievement_category3, "R&D Engineer", "Publish 10 times.", () => publicationCount >= 10),
    theory.createAchievement(9, achievement_category3, "\"That's Dr., not Mr.\"", "Publish 25 times.", () => publicationCount >= 25),
  ];
  updateAvailability();
}

{
  // Internal
  var calculateAchievementMultiplier = () => {
    let count = 0;
    for (const achievement of achievements) {
      if (achievement.isUnlocked) {
        count++
      }
    }
    achievementMultiplier = Math.pow(400, ((achievementMultiplierUpgrade.level > 0) * 0.05*count));
  }

  var updateAvailability = () => {
    kickT.isAvailable = autoKick.level == 0;
    c1Exponent.isAvailable  = autoKick.level >= 1;
    r1Exponent.isAvailable = autoKick.level >= 1;
    unlockR3.isAvailable = autoKick.level >= 1 && c1Exponent.level >= 3 && r1Exponent.level >= 3;
    r2Exponent.isAvailable = unlockR3.level > 0;
    c1BaseUpgrade.isAvailable = unlockR3.level > 0;
    rExponent.isAvailable = r2Exponent.level >= 2 && c1BaseUpgrade.level >= 2;

    r3.isAvailable = unlockR3.level > 0;
  }

  var getInternalState = () => `${T.toString()} ${error[0].toString()} ${integral.toString()} ${kp.toString()} ${ti.toString()} ${td.toString()} ${valve.toString()} ${publicationCount.toString()} ${r} ${autoKickerEnabled} ${cycleEstimate} ${setPoint} ${rEstimate} ${amplitude} ${frequency}`;

  var setInternalState = (state) => {
    debug = state;
    let values = state.split(" ");
    if (values.length > 0) T = BigNumber.from(parseFloat(values[0]));
    if (values.length > 1) error[0] = parseFloat(values[1]);
    if (values.length > 2) integral = parseFloat(values[2]);
    if (values.length > 3) kp = parseFloat(values[3]);
    if (values.length > 4) ti = parseFloat(values[4]);
    if (values.length > 5) td = parseFloat(values[5]);
    if (values.length > 6) valve = parseFloat(values[6]);
    if (values.length > 7) publicationCount = parseFloat(values[7])
    if (values.length > 8) r = BigNumber.from(parseFloat(values[8]));
    if (values.length > 9) autoKickerEnabled = values[9] == "true";
    if (values.length > 10) cycleEstimate = BigNumber.from(parseFloat(values[10]));
    if (values.length > 11) setPoint = parseFloat(values[11]);
    if (values.length > 12) rEstimate = BigNumber.from(parseFloat(values[12]));
    if (values.length > 13) amplitude = parseFloat(values[13]);
    if (values.length > 14) frequency = parseFloat(values[14]);
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

// Flag set to unlock the 'auto kicker'
  var canGoToPreviousStage = () => autoKick.level > 0;
// Flag set to unlock PID configuration
  var canGoToNextStage = () => changePidValues.level > 0;

  const createAutoKickerMenu = () => {
    let amplitudeText = "Value to set T. Currently: ";
    let frequencyText = "Frequency in seconds: ";
    let amplitudeLabel, frequencyLabel;
    let amplitudeSlider, frequencySlider;
    let menu = ui.createPopup({
      title: "Automatically Adjust T",
      content: ui.createStackLayout({
        children: [
          amplitudeLabel = ui.createLabel({text: amplitudeText + amplitude.toPrecision(3)}),
          amplitudeSlider = ui.createSlider({ 
            onValueChanged: () => amplitudeLabel.text = amplitudeText + amplitudeSlider.value.toPrecision(3),
          }),
          frequencyLabel = ui.createLabel({text: frequencyText + frequency.toPrecision(3)}),
          frequencySlider = ui.createSlider({
            onValueChanged: () => frequencyLabel.text = frequencyText + frequencySlider.value.toPrecision(3),
          }),
          ui.createLabel({text: "Off/On"}),
          autoKickerSwitch = ui.createSwitch({
            isToggled: () => autoKickerEnabled,
            onTouched: (e) => {if (e.type == TouchType.PRESSED) autoKickerEnabled = !autoKickerEnabled }
          }),
          cycleEstimateLabel = ui.createLatexLabel({text: cycleEstimateText  + cycleEstimate.toString()}),
          rEstimateLabel = ui.createLatexLabel({text: rEstimateText + rEstimate.toString()}),
          ui.createButton({
            text: "Update",
            onClicked: () => {
              amplitude = amplitudeSlider.value;
              frequency = frequencySlider.value
            }
          })
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
    let setPointText ="{T}_{sp} = "
    let kpTextLabel, tiTextLabel, tdTextLabel, setPointTextLabel;
    let kpSlider, tiSlider, tdSlider, setPointSlider;
    let menu = ui.createPopup({
      title: "Configure PID",
      content: ui.createStackLayout({
        children: [
          kpTextLabel = ui.createLatexLabel({text: Utils.getMath(kpText + kp.toString())}),
          kpSlider = ui.createSlider({
            value: Math.log10(kp),
            minimum: -2,
            maximum: 2,
            onValueChanged: () => {
              kpTextLabel.text = Utils.getMath(kpText + Math.pow(10, kpSlider.value).toPrecision(2).toString());
              newKp = Math.pow(10, kpSlider.value);
            },
          }),
          tiTextLabel = ui.createLatexLabel({text: Utils.getMath(tiText + ti.toString())}),
          tiSlider = ui.createSlider({
            value: Math.log10(ti),
            minimum: -2,
            maximum: 1,
            onValueChanged: () => {
              tiTextLabel.text = Utils.getMath(tiText + Math.pow(10, tiSlider.value).toPrecision(2).toString());
              newTi = Math.pow(10, tiSlider.value);
            },
          }),
          tdTextLabel = ui.createLatexLabel({text: Utils.getMath(tdText + td.toString())}),
          tdSlider = ui.createSlider({
            value: Math.log10(td),
            minimum: -2,
            maximum: 1,
            onValueChanged: () => {
              tdTextLabel.text = Utils.getMath(tdText + Math.pow(10, tdSlider.value).toPrecision(2).toString());
              newTd = Math.pow(10, tdSlider.value);
            },
          }),
          setPointTextLabel = ui.createLatexLabel({text: Utils.getMath(setPointText + setPoint.toPrecision(3))}),
          setPointSlider = ui.createSlider({
            onValueChanged: () => {
              setPointTextLabel.text = Utils.getMath(setPointText + setPointSlider.value.toPrecision(3));
              newSetPoint = setPointSlider.value;
            },
          }),
          ui.createButton({text: "Update", onClicked: updatePidValues})
        ]
      })
    })
    setPointSlider.maximum = Th;
    setPointSlider.minimum = Tc;
    setPointSlider.value =  setPoint;
    return menu;
  }

  var goToNextStage = () => {
    var pidMenu = createPidMenu();
    pidMenu.show();
  };

  var goToPreviousStage = () => {
    var autoKickMenu = createAutoKickerMenu();
    autoKickMenu.show();
  }

  var resetStage = () => {
    c1.level = 0;
    r1.level = 0;
    r2.level = 0;
    tDotExponent.level = 0;
    rho.value=BigNumber.ZERO;
    initialiseSystem();
  }

  var tick = (elapsedTime, multiplier) => {
    calculateAchievementMultiplier();
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;

    if (achievementMultiplierUpgrade.level > 0) bonus *= achievementMultiplier;
    timer += systemDt;
    if (timer > frequency*10 && autoKickerEnabled == true) {
      cycleEstimate = BigNumber.from(Math.abs(amplitude-T)/(timer/10));
      if(cycleEstimateLabel) cycleEstimateLabel.text = cycleEstimateText + cycleEstimate.toString();
      cycleR = BigNumber.ZERO;
      T = amplitude;
      timer = 0;
      integral = 0;
    }

    integral += (Math.abs(error[0]) < 15) * error[0]
    output = kp * (error[0] + systemDt/ti * integral + td/systemDt * (error[0] - error[1]));
    if (output>100){
      valve = 1
    }
    else if (output < -100)
    {
      valve = -1
    }
    else{
      valve = output/100;
    }

    let dT = 0;
    let prevT = T;

    if (valve > 0) {
      T = Th + (T - Th) * BigNumber.E.pow(-1 * Math.abs(valve) * systemDt)
    } else if (valve < 0) {
      T = Tc + (T - Tc) * BigNumber.E.pow(-1 * Math.abs(valve) * systemDt)
    }

    let dr = getR1(r1.level).pow(getR1Exp(r1Exponent.level))*getR2(r2.level).pow(getR2Exp(r2Exponent.level))*getR3((unlockR3.level > 0) * r3.level)/(1+Math.log10(1+Math.abs(error[0])));
    rEstimate = rEstimate * 0.95 + dr * 0.05;
    if(rEstimateLabel) rEstimateLabel.text = rEstimateText + rEstimate.toString();
    dT = BigNumber.from((T - prevT) / systemDt).abs();
    r += dr * dt;
    let value_c1 = getC1(c1.level).pow(getC1Exp(c1Exponent.level));
    rho.value += r.pow(getRExp(rExponent.level)) * BigNumber.from(value_c1 * dT.pow(getTdotExponent(tDotExponent.level))).sqrt() * dt * bonus; 
    error[1] = error[0];
    error[0] = setPoint - T;
    theory.invalidateTertiaryEquation();
  }
}


{
  // Equations

  var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 90;
    theory.primaryEquationScale = 1;
    let result = "\\begin{matrix}"

    let c1_exp = c1Exponent.level > 0 ? getC1Exp(c1Exponent.level).toNumber() : "";
    let r_exp = rExponent.level > 0 ? getRExp(rExponent.level).toNumber() : "";
    let r1_exp = r1Exponent.level > 0 ? getR1Exp(r1Exponent.level).toNumber() : "";
    let r2_exp = r2Exponent.level > 0 ? getR2Exp(r2Exponent.level).toNumber() : "";
    let r3_string = unlockR3.level > 0 ? "r_3": "";
    result += "\\dot{T} = \\left\\{ \\begin{array}{cl} Q_{h} & : \\ u(t) > 0, \\ Q_h = " + Th +" - T \\\\ Q_{c} & : \\ u(t) < 0, \\ Q_c = T- "+ Tc + "  \\end{array} \\right.\\\\";

    result += "\\dot{\\rho} = r^{" + r_exp + "}\\sqrt{c_1^{" + c1_exp +"}\\dot{T}^{" + getTdotExponent(tDotExponent.level) + "}}";
    result += ", \\;\\dot{r} = \\frac{r_1^{"+ r1_exp +"} r_2^{"+ r2_exp +"} "+ r3_string + "}{1+\\log_{10}(1 + \|e(t)\|)}"

    result += "\\end{matrix}"
    return result;
  }

  var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 75;
    theory.secondaryEquationScale = 0.9;
    let result = "\\begin{array}{c}";
    result += "e(t) = T_{sp} - T \\\\";
    result += "u(t) = K_p(e(t) + \\frac{1}{t_i}\\int_{0}^{t}e(\\tau)d\\tau \\ + t_d \\dot{e(t)})\\\\";
    result += theory.latexSymbol + "=\\max\\rho^{"+publicationExponent+"} , \\ K_p =" + kp.toPrecision(2) + ",\\ t_i =" + ti.toPrecision(2) + ",\\ t_d =" + td.toPrecision(2);
    result += "\\end{array}"
    return result;
  }

  var getTertiaryEquation = () => {
    let result = "";
    result += "T =" + Math.fround(T).toPrecision(5);
    result += ",\\,T_{sp} =" + setPoint.toPrecision(3) + ",\\ e(t) = " + Math.fround(error[0]).toPrecision(3);
    result += ",\\,\\epsilon =" + getTolerance(c1BaseUpgrade.level);
    result += ",\\, r ="+ r;
    return result;
  }
}
var getCustomCost = (level) => {
  let result = 1;
  switch(level) {
    case 0: result = 10; break;
    case 1: result = 35; break;
    case 2: result = 60; break;
    case 3: result = 85; break;
    case 4: result = 110; break;
    case 5: result = 135; break;
    case 6: result = 160; break;
    case 7: result = 185; break;
    case 8: result = 215; break;
    case 9: result = 230; break;
    case 10: result = 245; break;
    case 11: result = 260; break;
    case 12: result = 290; break;
    case 13: result = 320; break;
  }
  return result*0.2;
}
var getC1Exp = (level) => BigNumber.from(1 + c1Exponent.level * 0.05);
var getRExp = (level) => BigNumber.from(1 + rExponent.level * 0.04);
var getR1Exp = (level) => BigNumber.from(1 + r1Exponent.level * 0.05);
var getR2Exp = (level) => BigNumber.from(1 + r2Exponent.level * r2ExponentScale);
var getC1 = (level) => BigNumber.from(C1Base + c1BaseUpgrade.level * 0.125).pow(level);
var getR1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);
var getR2 = (level) => BigNumber.TWO.pow(level + r2Exponent.level*r2ExponentScale);
var getR3 = (level) => BigNumber.FIVE.pow(level);
var getTolerance = (level) => parseFloat(baseTolerance * BigNumber.TEN.pow(-parseInt(level)));
var getTdotExponent = (level) => 2 + level;
var getPublicationMultiplier = (tau) => achievementMultiplier * tau.pow(0.5)/2;
var getPublicationMultiplierFormula = (symbol) => (achievementMultiplier > 1 ? BigNumber.from(achievementMultiplier).toString(2) + "\\times \\frac{" + symbol + "^{0.5}}{2}" : "\\frac{" + symbol + "^{0.5}}{2}");
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
