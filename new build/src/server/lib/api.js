/* api accees keys that can be used to access the google genomics server
 * Ideally create your own and place it in here for testing, or keep it
 * on your own personal computer
 */

module.exports = {
/* Ron Amar API KEY
 * Works from within bader lab and morris ip addresses
 * Bader Lab IP: 142.150.84.71
 * Morris Lab IP:
 */
	'ronAmmar' : "AIzaSyDQ37_4RW9gHeWxwaEn1Ab-7_kHAAFLXXM",



/* Patrick Magee Api Key
 * Works from his home (for remote access to google server)
 * and baderlab
 * Patrick Magee's IP: 
 * Bader lab IP: 142.150.84.71
 */

	'patrickMagee' : "AIzaSyCJhrE5GaVPOiqK5A-8C6u788IKaA8oPqI",


//THIS MUST BE SET MANUALLY!
/* Google Authentiction Api and Key
*/
	'googleAuth':{
		'clientID':'334039958757-p8krqr6ur1j6s24hr7l9mi848s0kp7uv.apps.googleusercontent.com',
		'clientSecret': 'gk7XLxyCr5CNwXX2lTQFu43j',
		'callbackURL' : 'http://localhost:8080/auth/google/callback'
	}
}