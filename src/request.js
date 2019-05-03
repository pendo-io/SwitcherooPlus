var
	rules,
	lastRequestId;

// helper function to synchronization local rules with rules in chrome.storage.sync
function syncRules(){
	chrome.storage.sync.get(['rules'], function(syncData) {
		if (typeof syncData.rules === 'undefined') {
			rules = [];
		} else {
			rules = JSON.parse(syncData.rules);
		}
		chrome.runtime.sendMessage({
			syncDataUpdated : true,
			rules : rules
		});
	});
}
// sync local rules once at start
syncRules();

// sync local rules once chrome.storage.sync received update
chrome.storage.onChanged.addListener(function(changes, namespace) {
	syncRules();
});


chrome.webRequest.onBeforeRequest.addListener(function(details) {
	return redirectToMatchingRule(details);
},
{urls : ["<all_urls>"]}, ["blocking"]);

function redirectToMatchingRule(details) {

	for (var i = 0; i < rules.length; i++) {
		var rule = rules[i];
		var sURL = details.url;

		if (rule.isRegex) {
			if (rule.isActive && details.requestId !== lastRequestId) {
				if (rule.from.substring(0,1) == "/") {
					// qualified regex string like /blah/ig
					var expr = rule.from.substr(rule.from.indexOf("/")+1, rule.from.lastIndexOf("/")-1);
					var switches = rule.from.substr(rule.from.lastIndexOf("/")+1);
					var regx = new RegExp(expr, switches);
				} else {
					// shorthand regex like blah
					var regx = new RegExp(rule.from);
				}

				if (sURL.match(regx)) {
					lastRequestId = details.requestId; // save that we already replaced this request.
					sURL = sURL.replace(regx, rule.to);
					details.url = sURL;
					return{
						redirectUrl : details.url
					};
				}
			}
		} else {
			if (rule.isActive && details.url.indexOf(rule.from) > -1 && details.requestId !== lastRequestId ) {
				lastRequestId = details.requestId;
				return{
					redirectUrl : details.url.replace(rule.from, rule.to)
				};
			}
		}
	}
}

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	if ( typeof request.addRule !== 'undefined') {
		if (typeof request.addRuleAt !== 'undefined'){
			rules.splice(request.addRuleAt, 0, request.addRule);
		} else {
			rules.push(request.addRule);
		}
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.removeAllRules !== 'undefined') {
		rules = [];
		updateLocalStorage(rules)
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.getRules !== 'undefined') {
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.toggleIndex !== 'undefined') {
		rules[request.toggleIndex].isActive = !rules[request.toggleIndex].isActive;
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.editIndex !== 'undefined') {
		rules[request.editIndex] = request.updatedRule;
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.removeIndex !== 'undefined') {
		rules.splice(request.removeIndex, 1);
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.moveIndex !== 'undefined') {
		tmp = rules[request.moveIndex[0]];
		rules.splice(request.moveIndex[0], 1);
		rules.splice(request.moveIndex[1], 0, tmp);
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	} else if ( typeof request.getIndex !== 'undefined') {
		sendResponse({
			rule : rules[request.getIndex]
		});
	} else if ( typeof request.importAllRules !== 'undefined') {
		rules = request.ruleset;
		updateLocalStorage(rules);
		sendResponse({
			rules : this.rules
		});
	}
});

function updateLocalStorage(rules){
	rules_str = JSON.stringify(rules);
	// update chrome.storage.sync rules
	chrome.storage.sync.set({rules: rules_str}, function() {
		console.log('Value is set to \n' + rules_str);
	});
	// save a local copy
	localStorage['rules'] = rules_str;
}
