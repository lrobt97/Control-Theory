import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";

var id = "control_theory";
var name = "Control Theory";
var description = "Control Theory is a tool used in engineering to maintain a variable at a set value (known as the 'set point'). \n \n To make progress, you will need to disturb T to change rho, however going over a certain threshold will reset your progress. You will also need to grow the variable 'r', this grows faster when T is close to the setpoint, T_sp. \n \n The controller works by calculating the error, e(t) between T and the set point, T_sp. The controller used in this theory will be a PID -- proportional, integral and derivative controller. K_p represents the proportional gain of the system - in other words how much the output changes depending on the error sum within the brackets. The integral term sums up the past errors and attempts to minimise the error after t_i seconds. The derivative term attempts to predict the future error after t_d seconds based on the current derivative of e(t). At some point you will also be able to manually change the values k_p, t_i, t_d, and T_sp to explore the system more deeply and to improve rho gain.\n \n For this example, you will assume that this is a heating controller system. The PID controller will adjust the heater so that T reaches the set point. For the purpose of the simulation, u(t) will be considered as a percentage change, in the real world this would correspond to opening a valve to allow heating/cooling fluid to change the temperature. \n \n "; 
var authors = "Gaunter#7599, peanut#6368";
var version = 1.3;
var publicationExponent = 0.1;
var achievements;

// Currency
var rho;

// System variables
var d1, d0, fd1, fd0, r, T, output, kp, td, ti, setPoint, output, error, integral, systemDt, valve, timer, amplitude, frequency, autoKickerEnabled, baseTolerance, achievementMultiplier, publicationCount;
timer = 0;
frequency = 1.2;
T = BigNumber.from(100);
r = BigNumber.from(1)
kp = 1;
ti = 5;
td = 0.2;
valve = BigNumber.ZERO;
integral = 0;
error = [0, 0, 0];
output = 0;
d1 = 0;
d0 = 0;
fd1 = 0;
fd0 = 0;
amplitude = 125;
autoKickerEnabled = false;
baseTolerance = 5;
achievementMultiplier = 1;
publicationCount = 0;

// Upgrades
var c1, Th, Tc, r1, r2, kickT, Tmax, changePidValues, autoKick, achievementMultiplierUpgrade, tDotExponent;

// Milestones
var c1Exponent, rExponent, toleranceReduction;


var init = () => {
  rho = theory.createCurrency();

  /////////////////////
  // Milestone Upgrades

  theory.setMilestoneCost(new LinearCost(10*publicationExponent, 25*publicationExponent));
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
    c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("c1", 0.05)
    c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("c1", "0.05")
    c1Exponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  {
    rExponent = theory.createMilestoneUpgrade(2, 3);
    rExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r1", 0.05);
    rExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r1", "0.05");
    rExponent.boughtOrRefunded = (_) => { updateAvailability(); theory.invalidatePrimaryEquation(); }
  }

  {
    toleranceReduction = theory.createMilestoneUpgrade(3, 2);
    toleranceReduction.getInfo = (level) => Utils.getMathTo("\\epsilon" , getTolerance(level));
    toleranceReduction.getDescription = (level) => Utils.getMath("\\epsilon = " + getTolerance(level))
    toleranceReduction.boughtOrRefunded = (_) => updateAvailability();
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
    achievementMultiplierUpgrade = theory.createPermanentUpgrade(5, rho, new LinearCost (1e50, 0))
    achievementMultiplierUpgrade.maxLevel = 1;
    achievementMultiplierUpgrade.getDescription = (_) => "Achievement multiplier"
    achievementMultiplierUpgrade.getInfo = (_) => "Multiplies income by " + achievementMultiplier.toPrecision(3);
  }

  // Kick T
  {
    kickT = theory.createUpgrade(0, rho, new FreeCost())
    kickT.getDescription = (_) => Utils.getMath("T=125");
    kickT.getInfo = (_) => Utils.getMathTo("T=" + T, "T=125");
    kickT.bought = (_) => T = amplitude;
  }


  /////////////////////
  // Upgrades

  // c1
  {
    let getDesc = (level) => "c_1=2^{" + level + "}";
    let getInfo = (level) => "c_1=" + getC1(level).toString(0);
    c1 = theory.createUpgrade(1, rho, new ExponentialCost(3000, Math.log2(8)));
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

  //Th
  {
    let getInfo = (level) => "T_h=" + getTh(level).toString();
    let getDesc = (level) => "T_h=" + getTh(level).toString();
    Th = theory.createUpgrade(4, rho, new ExponentialCost(3000, Math.log2(10)));
    Th.maxLevel = 30;
    Th.getDescription = (_) => Utils.getMath(getDesc(Th.level));
    Th.getInfo = (amount) => Utils.getMathTo(getInfo(Th.level), getInfo(Th.level + amount))
  }

  //Tc
  {
    let getInfo = (level) => "T_c=" + getTc(level).toPrecision(3).toString();
    let getDesc = (level) => "T_c=" + getTc(level).toPrecision(3).toString();
    Tc = theory.createUpgrade(5, rho, new ExponentialCost(3000, Math.log2(10)));
    Tc.maxLevel = 37;
    Tc.getDescription = (_) => Utils.getMath(getDesc(Tc.level));
    Tc.getInfo = (amount) => Utils.getMathTo(getInfo(Tc.level), getInfo(Tc.level + amount))
  }

  //Tmax
  {
    let getInfo = (level) => "T_{max}=" + getTmax(level).toString();
    let getDesc = (level) => "T_{max}=" + getTmax(level).toString();
    Tmax = theory.createUpgrade(6, rho, new ExponentialCost(10000, Math.log2(10)));
    Tmax.getDescription = (_) => Utils.getMath(getDesc(Tmax.level));
    Tmax.getInfo = (amount) => Utils.getMathTo(getInfo(Tmax.level), getInfo(Tmax.level + amount))
    Tmax.bought = (_) => theory.invalidateTertiaryEquation();
  }
  //Tdot exponent
  {
    let getInfo = (level) => "\\dot{T} ^{" + getTdotExponent(level) +"}";
    let getDesc = (level) => "\\dot{T} \\ exponent =" + getTdotExponent(level).toString();
    tDotExponent = theory.createUpgrade(7, rho, new ExponentialCost(10000, Math.log2(10**4)));
    tDotExponent.getDescription = (_) => Utils.getMath(getDesc(tDotExponent.level));
    tDotExponent.getInfo = (amount) => Utils.getMathTo(getInfo(tDotExponent.level), getInfo(tDotExponent.level + amount))
    tDotExponent.bought = (_) => theory.invalidatePrimaryEquation();
  }
  systemDt = 0.01;
  setPoint = 100;

  /////////////////////
  // Achievements

  let achievement_category1 = theory.createAchievementCategory(0, "Temperature");
  let achievement_category2 = theory.createAchievementCategory(1, "Milestones");
  let achievement_category3 = theory.createAchievementCategory(2, "Publications");

  achievements = [

    // Temperature
    theory.createAchievement(0, achievement_category1, "Superheated", "Have T exceed 300.", () => T > BigNumber.from(300)),
    theory.createAchievement(1, achievement_category1, "Sub-zero", "Have T plummet below 0.", () => T < BigNumber.from(0)),
    theory.createAchievement(2, achievement_category1, "Absolute 0", "Have T plummet below -273.", () => T < BigNumber.from(-273)),

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
    achievementMultiplier = 2 // Math.pow(2, (0.1*count));
  }

  var updateAvailability = () => {
    kickT.isAvailable = autoKick.level == 0;
    c1Exponent.isAvailable  = autoKick.level >= 1;
    rExponent.isAvailable = autoKick.level >= 1;
    toleranceReduction.isAvailable = autoKick.level >= 1
  }

  var getInternalState = () => `${T.toString()} ${error[0].toString()} ${integral.toString()} ${kp.toString()} ${ti.toString()} ${td.toString()} ${valve.toString()} ${publicationCount.toString()} ${r} ${autoKickerEnabled}`;

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
    let frequencyText = "Frequency in seconds: "
    let amplitudeLabel, frequencyLabel;
    let amplitudeSlider, frequencySlider;
    let autoKickerSwitch;
    log(setPoint + 10);
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
    amplitudeSlider.maximum = getTmax(Tmax.level);         
    amplitudeSlider.minimum = getTc(Tc.level);
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
    setPointSlider.maximum = getTh(Th.level);
    setPointSlider.minimum = getTc(Tc.level);
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
    T = BigNumber.from(100);
    setPoint = BigNumber.from(100);
    prevError = BigNumber.ZERO;
    integral = BigNumber.ZERO;
    rho.value = BigNumber.ZERO;
    c1.level = 0;
    c2.level = 0;
    c3.level = 0;
    Th.level = 0;
    Tc.level = 0;
    Tmax.level = 0;
    kickT.level = 0;
  }

  var tick = (elapsedTime, multiplier) => {
    calculateAchievementMultiplier();
    let dt = BigNumber.from(elapsedTime * multiplier);
    let bonus = theory.publicationMultiplier;
    if (achievementMultiplierUpgrade.level > 0) bonus *= achievementMultiplier;

    error[2] = error[1];
    error[1] = error[0];
    error[0] = T - setPoint;
    let A0 = kp * kp/ti * (dt);
    let A1 = -1 * kp;
    let A0d = kp*td/(dt);
    let A1d = - 2 * kp*td/(dt);
    let A2d = kp*td/(dt);
    let N = 1;
    let timeConstant = td/N;
    let alpha = (dt)/(2*timeConstant);
    output = A0 * error[0] + A1 * error[1];
    d1 = d0
    d0 = A0d * error[0] + A1d * error[1] + A2d * error[2];
    fd1 = fd0;
    fd0 = ((alpha)/(alpha+1)) * (d1 + d0) - ((alpha - 1)/(alpha + 1)) * fd1
    output = (output + fd0);
    if (Math.abs(error) <= getTolerance(toleranceReduction.level)) {
      output = 0;
    }
    // Normalise output so it is proportional to the gap between setPoint and Tc/Th
    if (output > 0) {
      if (T + output  < getTh(Th.level)) {
        valveTarget = ((T + output) - getTh(Th.level)) / (T - getTh(Th.level));
      }
      else{
        valveTarget = 1
      }
    }
    else if (output < 0){
      if (T + output  > getTc(Tc.level)) {
        valveTarget = -1* ((T + output) - getTc(Tc.level))/(T - getTc(Tc.level));
      }
      else{
        valveTarget = -1
      }    
    }
    else if (Math.abs(error[0]) < getTolerance(toleranceReduction.level)) valveTarget = 0;

    let dT = 0;

    // Take the exponential moving average to smooth the transition
    valve = 0.03 * valveTarget + 0.97 * valve;
    let prevT = T;
    if (valve > 0) {
      T = getTh(Th.level) + (T - getTh(Th.level)) * BigNumber.E.pow(-1 * Math.abs(valve) * dt)
    } else if (valve < 0) {
      T = getTc(Tc.level) + (T - getTc(Tc.level)) * BigNumber.E.pow(-1 * Math.abs(valve) * dt)
    }

    dT = BigNumber.from((T - prevT) / dt).abs();
    r += getR1(r1.level)*getR2(r2.level)/(1+Math.abs(error[0])) * dt;

    let value_c1 = getC1(c1.level).pow(getC1Exp(c1Exponent.level));
    let value_r = r.pow(getRExp(rExponent.level))

    rho.value += value_r * BigNumber.from(value_c1 * dT.pow(getTdotExponent(tDotExponent.level))).sqrt() * dt * bonus; // use bignumber sqrt and pow, not Math ones, they dont support values above 1e308 - peanut

    // reset integral error when system converges
    if (dT < 0.001) {
      integral = 0;
    }

    timer += dt;
    if (timer > frequency && autoKickerEnabled == true) {
      T = amplitude;
      timer = 0;
    }

    if (T > getTmax(Tmax.level)) {
      resetStage();
    }

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
    let r1_exp = rExponent.level > 0 ? getRExp(rExponent.level).toNumber() : "";

    result += "\\dot{T} = \\left\\{ \\begin{array}{cl} Q_{h} & : \\ u(t) > 0, \\ Q_h = T_h - T \\\\ Q_{c} & : \\ u(t) < 0, \\ Q_c = T-T_c  \\end{array} \\right.\\\\";

    result += "\\dot{\\rho} = r^{" + r1_exp + "}\\sqrt{c_1^{" + c1_exp +"}\\dot{T}^{" + getTdotExponent(tDotExponent.level) + "}}";
    result += ", \\;\\dot{r} = \\frac{r_1 r_2}{1+\|e(t)\|}"

    result += "\\end{matrix}"
    return result;
  }

  var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 75;
    theory.secondaryEquationScale = 0.9;
    let result = "\\begin{array}{c}";
    result += "e(t) = T_{sp} - T \\\\";
    result += "u(t) = K_p(e(t) + \\frac{1}{t_i}\\int_{0}^{t}e(\\tau)d\\tau \\ + t_d \\dot{e(t)})\\\\";
    result += theory.latexSymbol + "=\\max\\rho^{"+publicationExponent+"} , \\ K_p =" + kp.toPrecision(2) + ",\\ t_i =" + ti.toPrecision(2) + ",\\ t_d =" + td.toPrecision(2) + "\, \\ T_{max} =" + getTmax(Tmax.level);
    result += "\\end{array}"
    return result;
  }

  var getTertiaryEquation = () => {
    let result = "";
    result += "T =" + Math.fround(T).toPrecision(5);
    result += ",\\,T_{sp} =" + setPoint.toPrecision(3) + ",\\ e(t) = " + Math.fround(error[0]).toPrecision(3);
    result += ",\\,\\epsilon =" + getTolerance(toleranceReduction.level);
    result += ",\\, r ="+ r;
    return result;
  }
}

var getC1Exp = (level) => BigNumber.from(1 + c1Exponent.level * 0.05);
var getRExp = (level) => BigNumber.from(1 + rExponent.level * 0.05);

var getC1 = (level) => BigNumber.TWO.pow(level);
var getR1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);
var getR2 = (level) => BigNumber.TWO.pow(level);
var getTh = (level) => 110 + 10 * level;
var getTc = (level) => 96.9 - 10 * level;
var getTmax = (level) => 150 + 10 * level;
var getTolerance = (level) => parseFloat(baseTolerance * BigNumber.TEN.pow(-parseInt(level)));
var getTdotExponent = (level) => 2 + level;
var getPublicationMultiplier = (tau) => achievementMultiplier;
var getPublicationMultiplierFormula = (symbol) => (achievementMultiplier > 1 ? BigNumber.from(achievementMultiplier).toString(2) + "\\times" : "") + "{" + symbol;
var get2DGraphValue = () => (BigNumber.ONE + T).toNumber();
var getTau = () => rho.value.pow(publicationExponent);
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(3), rho.symbol];
var postPublish = () => {
  r = BigNumber.from(1);
  theory.invalidatePrimaryEquation();
  theory.invalidateTertiaryEquation();
  publicationCount++;
}
init();
