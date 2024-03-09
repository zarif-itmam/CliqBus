import java.io.*;
import java.util.*;

public class script {
    public static void main(String[] args) throws Exception {
        Reader fr = new FileReader("./user.txt");
        BufferedReader br = new BufferedReader(fr);
        FileWriter fw = new FileWriter("./User_Script.txt");
        BufferedWriter bw = new BufferedWriter(fw);
        Random random = new Random();
        String[] stands = { "Dhaka", "Bagerhat", "Bandarban", "Barguna", "Barisal", "Bhola", "Bogra", "Brahmanbaria",
                "Chandpur", "Chittagong", "Chuadanga", "Comilla", "Cox''s Bazar", "Dinajpur", "Faridpur", "Feni",
                "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jessore", "Jhalokathi", "Jhenaidah",
                "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur",
                "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur", "Moulvibazar", "Munshiganj",
                "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore", "Nawabganj", "Netrakona",
                "Nilphamari", "Noakhali", "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi",
                "Rangamati", "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet",
                "Tangail", "Thakurgaon" };
        while (true) {
            String s = br.readLine();
            if (s == null)
                break;
            String[] str = s.split(",");
            System.out.println(str.length);
            if (str.length > 5) {
                String str4 = str[4];
                for (int i = 4; i < str.length; i++) {
                    str4 = str4 + str[i];
                }
                str[4] = str4;
            }
            String str1 = "";
            for (int i = 0; i < str[4].length(); i++) {
                if (str[4].charAt(i) == 34 || str[4].charAt(i) == 39 || str[4].charAt(i) == 123
                        || str[4].charAt(i) == 125 || str[4].charAt(i) == 40 || str[4].charAt(i) == 41) {
                } else {
                    str1 = str1 + str[4].charAt(i);
                }
            }
            str[4]=str1;
            str1 = "";
            for (int i = 0; i < str[0].length(); i++) {
                if (str[0].charAt(i) == 34 || str[0].charAt(i) == 39 || str[0].charAt(i) == 123
                        || str[0].charAt(i) == 125 || str[0].charAt(i) == 40 || str[0].charAt(i) == 41) {
                } else {
                    str1 = str1 + str[0].charAt(i);
                }
            }
            str[0] = str1;
            int districtIndex = random.nextInt(stands.length);
            int postalCode = random.nextInt(10000);
            String insertStatement = "INSERT INTO USER_ACCOUNT(USER_ID,NAME,PASSWORD,PHONE_NO,EMAIL,DISTRICT,POSTAL_CODE,STREET) VALUES(SEQ_USER.NEXTVAL,'"
                    + str[0] + "',ORA_HASH('" + str[4] + "'),'" + str[1] + "','" + str[2] + "','"
                    + stands[districtIndex] + "','" + postalCode + "','" + str[3] + "');";
            bw.write(insertStatement);
            bw.newLine();
        }
        bw.close();
        fw.close();
        br.close();
        fr.close();
    }
}

// Dhaka
// Bagerhat
// Bandarban
// Barguna
// Barisal
// Bhola
// Bogra
// Brahmanbaria
// Chandpur
// Chittagong
// Chuadanga
// Comilla
// Cox's Bazar
// Dinajpur
// Faridpur
// Feni
// Gaibandha
// Gazipur
// Gopalganj
// Habiganj
// Jamalpur
// Jessore
// Jhalokathi
// Jhenaidah
// Joypurhat
// Khagrachhari
// Khulna
// Kishoreganj
// Kurigram
// Kushtia
// Lakshmipur
// Lalmonirhat
// Madaripur
// Magura
// Manikganj
// Meherpur
// Moulvibazar
// Munshiganj
// Mymensingh
// Naogaon
// Narail
// Narayanganj
// Narsingdi
// Natore
// Nawabganj
// Netrakona
// Nilphamari
// Noakhali
// Pabna
// Panchagarh
// Patuakhali
// Pirojpur
// Rajbari
// Rajshahi
// Rangamati
// Rangpur
// Satkhira
// Shariatpur
// Sherpur
// Sirajganj
// Sunamganj
// Sylhet
// Tangail
// Thakurgaon